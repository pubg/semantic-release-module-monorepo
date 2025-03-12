import { identity, memoizeWith, pipeP } from 'ramda';
import pkgUp from 'pkg-up';
import readPkg from 'read-pkg';
import path from 'path';
import pLimit from 'p-limit';
import createDebug from 'debug';
import { getCommitFiles, getRoot } from './git-utils.js';
import { mapCommits } from './options-transforms.js';

const debug = createDebug('semantic-release:monorepo');
const memoizedGetCommitFiles = memoizeWith(identity, getCommitFiles);

/**
 * Get the normalized PACKAGE root path, relative to the git PROJECT root.
 */
const getPackagePath = async () => {
  const packagePath = await pkgUp();
  const gitRoot = await getRoot();

  return path.relative(gitRoot, path.resolve(packagePath, '..'));
};


const withFiles = async commits => {
  const limit = pLimit(Number(process.env.SRM_MAX_THREADS) || 500);
  return Promise.all(
    commits.map(commit =>
      limit(async () => {
        const files = await memoizedGetCommitFiles(commit.hash);
        return { ...commit, files };
      })
    )
  );
};

const onlyPackageCommits = async (pluginConfig, commits, logger) => {
  const packagePath = await getPackagePath();
  debug('Filter commits by package path: "%s"', packagePath);
  debug('Plugin config: %o', pluginConfig);
  
  const dependencies = pluginConfig?.dependencies || [];
  debug('Dependencies to check: %o', dependencies);
  
  const commitsWithFiles = await withFiles(commits);
  // Convert package root path into segments - one for each folder
  const packageSegments = packagePath.split(path.sep);
  
  // Normalize dependency paths and convert to segments
  const dependencyPaths = await Promise.all(dependencies.map(async dep => {
    const normalizedPath = dep;
    return {
      path: normalizedPath,
        segments: normalizedPath.split(path.sep),
      };
    })
  );

  logger.info('Dependency paths: %o', dependencyPaths);

  return commitsWithFiles.filter(({ files, subject }) => {
    // Normalise paths and check if any changed files' path segments start
    // with that of the package root.
    const packageFile = files.find(file => {
      const normalizedFile = path.normalize(file);
      const fileSegments = normalizedFile.split(path.sep);
      
      // Check if file belongs to main package
      const isPackageFile = packageSegments.every(
        (packageSegment, i) => packageSegment === fileSegments[i]
      );
      
      if (isPackageFile) return true;
      
      // Check if file belongs to any dependency paths
      return dependencyPaths.some(({ segments }) => 
        segments.every((segment, i) => segment === fileSegments[i])
      );
    });

    logger.info('Package file: %o', packageFile);

    if (packageFile) {
      debug(
        'Including commit "%s" because it modified package file "%s".',
        subject,
        packageFile
      );
    }

    return !!packageFile;
  });
};

// Async version of Ramda's `tap`
const tapA = fn => async x => {
  await fn(x);
  return x;
};

const logFilteredCommitCount = logger => async ({ commits }) => {
  const { name } = await readPkg();

  logger.log(
    'Found %s commits for package %s since last release',
    commits.length,
    name
  );
};

const withOnlyPackageCommits = plugin => async (pluginConfig, config) => {
  const { logger } = config;

  return plugin(
    pluginConfig,
    await pipeP(
      mapCommits(commits => onlyPackageCommits(pluginConfig, commits, logger)),
      tapA(logFilteredCommitCount(logger))
    )(config)
  );
};

export { withOnlyPackageCommits, onlyPackageCommits, withFiles };
