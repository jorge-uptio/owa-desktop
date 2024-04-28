// settings.js

const Store = require("electron-store");
const store = new Store();

function getHA() {
  const ha = store.get("ha");
  return ha;
}

function setHA(status) {
  store.set("ha", status);
  return status;
}

function getSessionData(email) {
  const sessionData = store.get(`session.${email}`) || {};
  return sessionData;
}

function setSessionData(email, data) {
  store.set(`session.${email}`, data);
}

module.exports = {
  getHA: getHA,
  setHA: setHA,
  getSessionData: getSessionData,
  setSessionData: setSessionData,
};

