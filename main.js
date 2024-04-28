// main.js

// https://www.electronforge.io/config/makers/squirrel.windows
if (require("electron-squirrel-startup")) return;

const {
  app,
  shell,
  BrowserWindow,
  Menu,
  MenuItem,
  session,
} = require("electron");
const { getSessionData, setSessionData } = require("./settings.js");

let windows = {}; // Store BrowserWindow instances by email

function createWindow(email) {
  if (windows[email]) {
    // If a window for this email already exists, focus it
    windows[email].focus();
    return;
  }

  // Create a unique session for this window
  const partition = `persist:${email}`;
  const ses = session.fromPartition(partition);

  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    title: `Outlook Desktop - ${email}`,
    icon: __dirname + "images/Outlook.ico",
    autoHideMenuBar: true,
    webPreferences: {
      spellcheck: true,
      webSecurity: true,
      contextIsolation: false,
      webviewTag: true,
      nodeIntegration: true,
      nativeWindowOpen: true,
      session: ses,
    },
  });

  windows[email] = window;

  // Load the Outlook URL with the email parameter
  window.loadURL(`https://outlook.office.com/?email=${email}`);

  // Open links with External Browser
  // https://stackoverflow.com/a/67409223
  // window.webContents.setWindowOpenHandler(({ url }) => {
  //   shell.openExternal(url);
  //   return { action: "deny" };
  // });

  window.webContents.setWindowOpenHandler(({ url }) => {
    // Check if the URL belongs to Outlook
    const isOutlookUrl = url.includes("outlook.office.com");

    if (isOutlookUrl) {
      // Open the URL in a new window
      const newWindow = new BrowserWindow({
        width: 800,
        height: 600,
        autoHideMenuBar: true,
        title: `Outlook New Window`,
        webPreferences: {
          spellcheck: true,
          webSecurity: true,
          contextIsolation: false,
          webviewTag: true,
          nodeIntegration: true,
          nativeWindowOpen: true,
          session: ses,
        },
      });
      newWindow.loadURL(url);
      // return { action: "deny" };
    } else {
      // Open the URL in the external browser
      shell.openExternal(url);
      return { action: "deny" };
    }
  });

  window.webContents.on("context-menu", (event, params) => {
    const menu = new Menu();

    // Add each spelling suggestion
    for (const suggestion of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => window.webContents.replaceMisspelling(suggestion),
        }),
      );
    }

    // Allow users to add the misspelled word to the dictionary
    if (params.misspelledWord) {
      menu.append(
        new MenuItem({
          label: "Add to dictionary",
          click: () =>
            window.webContents.session.addWordToSpellCheckerDictionary(
              params.misspelledWord,
            ),
        }),
      );
    }

    menu.popup();
  });

  window.webContents.session.on("will-download", (event, item, webContents) => {
    // Handle downloads or other session-related events
  });

  // Save session data when the window is closed
  window.on("close", () => {
    const sessionData = window.webContents.session.cookies;
    setSessionData(email, sessionData);
  });

  window.on("closed", () => {
    delete windows[email];
  });
}

app.on("ready", () => {
  const commandLineEmail = process.argv.find((arg) =>
    arg.startsWith("--email="),
  );
  if (commandLineEmail) {
    const email = commandLineEmail.split("=")[1];
    createWindow(email);
  } else {
    // Default behavior if no email is specified
    createWindow("default@example.com");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow("default@example.com");
  }
});
