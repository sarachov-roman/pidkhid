// Обгортка «Підхід» для Mac: відкриває веб-збірку застосунку у власному вікні.
const { app, BrowserWindow, nativeTheme, shell } = require('electron');
const path = require('path');

app.setName('Підхід');

function createWindow() {
  nativeTheme.themeSource = 'dark';
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 420,
    minHeight: 560,
    title: 'Підхід',
    backgroundColor: '#1B2026',
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'web', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // зовнішні посилання відкриваємо в браузері, а не всередині програми
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
