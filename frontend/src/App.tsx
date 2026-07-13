import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { AppProvider } from './app/AppContext';
import { AppRoutes } from './app/routes';
import { ScrollToTop } from './components/common/ScrollToTop';
import { WalletProvider } from './contexts/WalletContext';

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2F80ED',
          colorSuccess: '#27AE60',
          colorWarning: '#F2994A',
          colorError: '#EB5757',
          colorBgBase: '#F8FAFC',
          colorBgContainer: '#FFFFFF',
          colorBorder: '#E5E7EB',
          colorTextBase: '#111827',
          borderRadius: 8,
          wireframe: false,
          fontFamily: 'var(--font-body)',
        },
        components: {
          Card: {
            colorBorderSecondary: '#E5E7EB',
            borderRadiusLG: 8,
          },
          Layout: {
            bodyBg: '#F8FAFC',
            headerBg: '#FFFFFF',
            siderBg: '#FFFFFF',
          },
          Menu: {
            itemBorderRadius: 8,
            itemSelectedBg: 'rgba(47, 128, 237, 0.08)',
            itemSelectedColor: '#2F80ED',
          },
          Button: {
            controlHeightLG: 44,
          },
        },
      }}
    >
      <AntdApp>
        <AppProvider>
          <WalletProvider>
            <BrowserRouter>
              <ScrollToTop />
              <AppRoutes />
            </BrowserRouter>
          </WalletProvider>
        </AppProvider>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
