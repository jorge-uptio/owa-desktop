module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'owa-desktop',
    icon: __dirname + '/images/Outlook.ico'
  },
  makers: [
    // {
    //   name: '@electron-forge/maker-zip',
    //   platforms: ['linux']
    // }
    // {
    //   name: '@electron-forge/maker-squirrel',
    //   config: {
    //     iconUrl: 'https://raw.githubusercontent.com/mikepruett3/owa-desktop/main/images/Outlook.ico',
    //     setupIcon: __dirname + '/images/Outlook.ico'
    //   }
    // },
    // {
    //   name: '@electron-forge/maker-zip',
    //   platforms: ['darwin']
    // },
    // {
    //   name: '@electron-forge/maker-deb',
    //   config: {}
    // }
  ],
  publishers: [{
    name: '@electron-forge/publisher-github',
    config: {
      repository: {
        owner: 'jorge-uptio',
        name: 'owa-desktop'
      }
    }
  }]
};
