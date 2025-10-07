export default () => ({
  buildInfo: {
    buildNumber: process.env.SOCIAL_RETRY_APP_LABEL ?? 'localBuild',
  },
});
