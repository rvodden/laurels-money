// Settings for this deployment. Neither value is a secret: the client id is public by
// design, and the sheet can only be read by Google accounts it is shared with.
window.LAURELS_CONFIG = {
  // Google Cloud OAuth client (Web application) whose authorised origin is this site.
  clientId: 'REPLACE_WITH_OAUTH_CLIENT_ID.apps.googleusercontent.com',
  // "Laurel's Bills". The app reads its named ranges DashWeek, DashMonth and EmmaFileId.
  sheetId: '1IGeg0Jt0k8feLr7pHtnRHyxqYIXEo3TsejmTnnomfJo',
};
