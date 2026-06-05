const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chainsawAPI', {
  // Todos
  addTodo: (data) => ipcRenderer.invoke('add-todo', data),
  getTodos: (data) => ipcRenderer.invoke('get-todos', data),
  updateTodo: (data) => ipcRenderer.invoke('update-todo', data),
  deleteTodo: (data) => ipcRenderer.invoke('delete-todo', data),
  completeTodo: (data) => ipcRenderer.invoke('complete-todo', data),
  reorderTodos: (data) => ipcRenderer.invoke('reorder-todos', data),

  // Summary
  getSummary: (data) => ipcRenderer.invoke('get-summary', data),
  getCompletedTodos: (data) => ipcRenderer.invoke('get-completed-todos', data),

  // Recurring
  checkRecurring: () => ipcRenderer.invoke('check-recurring'),

  // Notification
  showNotification: (data) => ipcRenderer.invoke('show-notification', data),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),

  // Auto launch
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (data) => ipcRenderer.invoke('set-auto-launch', data),

  // Settings
  getSetting: (data) => ipcRenderer.invoke('get-setting', data),
  setSetting: (data) => ipcRenderer.invoke('set-setting', data),
});
