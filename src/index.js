import readPkg from 'read-pkg';
import { compose } from 'ramda';
import { wrapStep } from 'semantic-release-plugin-decorators';
import { withOnlyPackageCommits } from './only-package-commits.js';
import versionToGitTag from './version-to-git-tag.js';
import logPluginVersion from './log-plugin-version.js';
import {
  mapNextReleaseVersion,
  withOptionsTransforms,
} from './options-transforms.js';

const analyzeCommits = wrapStep(
  'analyzeCommits',
  compose(logPluginVersion('analyzeCommits'), withOnlyPackageCommits),
  {
    wrapperName: 'semantic-release-module-monorepo',
  }
);

const generateNotes = wrapStep(
  'generateNotes',
  compose(
    logPluginVersion('generateNotes'),
    withOnlyPackageCommits,
    withOptionsTransforms([mapNextReleaseVersion(versionToGitTag)])
  ),
  {
    wrapperName: 'semantic-release-module-monorepo',
  }
);

const success = wrapStep(
  'success',
  compose(
    logPluginVersion('success'),
    withOnlyPackageCommits,
    withOptionsTransforms([mapNextReleaseVersion(versionToGitTag)])
  ),
  {
    wrapperName: 'semantic-release-module-monorepo',
  }
);

const fail = wrapStep(
  'fail',
  compose(
    logPluginVersion('fail'),
    withOnlyPackageCommits,
    withOptionsTransforms([mapNextReleaseVersion(versionToGitTag)])
  ),
  {
    wrapperName: 'semantic-release-module-monorepo',
  }
);

const tagFormat = `${readPkg.sync().name}-v\${version}`;

export { analyzeCommits, generateNotes, success, fail, tagFormat };
