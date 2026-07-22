export const clearLegacyFrontendData = () => {
  localStorage.removeItem('nexus_lending_state_v2');
  localStorage.removeItem('nexus_lending_state_v3');
  localStorage.removeItem('nexus_notification_settings');
  Object.keys(localStorage)
    .filter((key) => key.startsWith('nexus_notification_settings_'))
    .forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('nexus_freighter_connected');
};

export const clearDemoData = clearLegacyFrontendData;
