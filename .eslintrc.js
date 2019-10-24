module.exports = {
  "extends": "airbnb-base",
  "rules": {
    "no-console": 0, // allow/disallow console usage in code
    "max-len": [
      2,
      180,
      2,
      {
        "ignoreComments": true,
        "ignoreUrls": true
      }
    ],
  }
};