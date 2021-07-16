import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Indices, Aliases } from '~/interfaces/search';

// TODO: GW-5134 SocketIoContainer 機能の swr 化
// TODO:GW-6816 [5134ブロック] ElasticsearchManagementにSocketIoを追加する
// import AdminSocketIoContainer from '~/client/js/services/AdminSocketIoContainer';
import { toastSuccess, toastError } from '~/client/js/util/apiNotification';

import StatusTable from '~/client/js/components/Admin/ElasticsearchManagement/StatusTable';
import ReconnectControls from '~/client/js/components/Admin/ElasticsearchManagement/ReconnectControls';
import NormalizeIndicesControls from '~/client/js/components/Admin/ElasticsearchManagement/NormalizeIndicesControls';
import RebuildIndexControls from '~/client/js/components/Admin/ElasticsearchManagement/RebuildIndexControls';
import { apiv3Post, apiv3Put } from '~/utils/apiv3-client';
import { useIndicesSWR } from '~/stores/search';

const ElasticsearchManagement = props => {
  const { t } = useTranslation();
  const { data, error, mutate } = useIndicesSWR();
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isReconnectingProcessing, setIsReconnectingProcessing] = useState<boolean>(false);
  const [isRebuildingProcessing, setIsRebuildingProcessing] = useState<boolean>(false);
  const [isRebuildingCompleted, setIsRebuildingCompleted] = useState<boolean>(false);

  const [isNormalized, setIsNormalized] = useState<boolean | null>(null);
  const [indicesData, setIndicesData] = useState<Indices | null>(null);
  const [aliasesData, setAliasesData] = useState<Aliases | null>(null);

  // TODO: GW-5134 SocketIoContainer 機能の swr 化
  // TODO: GW-6816 [5134ブロック] ElasticsearchManagementにSocketIoを追加する
  // useEffect(() => {
  //   initWebSockets();
  // }, []);
  // const initWebSockets = () => {
  //   const socket = props.adminSocketIoContainer.getSocket();
  //   socket.on('addPageProgress', data => {
  //     setIsRebuildingProcessing(true);
  //   });
  //   socket.on('finishAddPage', data => {
  //     setIsRebuildingProcessing(false);
  //     setIsRebuildingCompleted(true);
  //   });
  //   socket.on('rebuildingFailed', data => {
  //     toastError(new Error(data.error), 'Rebuilding Index has failed.');
  //   });
  // };

  useEffect(() => {
    retrieveIndicesStatus();
  }, [data]);

  const retrieveIndicesStatus = () => {
    if (data != null) {
      setIsConnected(true)
      setIsConfigured(true)
      setIndicesData(data?.info.indices)
      setAliasesData(data?.info.aliases)
      setIsNormalized(data?.info.isNormalized)
    }

    if (error != null) {
      setIsConnected(false);
      console.log(error)

      if (error[0].code === 'search-service-unconfigured') {
        setIsConfigured(false);
      }

      toastError(error);
    }
    setIsInitialized(true);

  }


  const reconnect = async () => {
    setIsReconnectingProcessing(true);

    try {
      await apiv3Post('/search/connection');
    } catch (e) {
      toastError(e);
      return;
    }

    window.location.reload();
  };

  const normalizeIndices = async () => {
    try {
      await apiv3Put('/search/indices', { operation: 'normalize' });
    } catch (e) {
      toastError(e);
    }

    await mutate();
    toastSuccess('Normalizing has succeeded');
  };

  const rebuildIndices = async () => {
    setIsRebuildingProcessing(true);

    try {
      await apiv3Put('/search/indices', { operation: 'rebuild' });
      toastSuccess('Rebuilding is requested');
    } catch (e) {
      toastError(e);
    }

    await mutate();
  };

  // TODO: GW- retrieve from SWR
  // const isErrorOccuredOnSearchService = !appContainer.config.isSearchServiceReachable;
  const isErrorOccuredOnSearchService = true;
  const isReconnectBtnEnabled = !isReconnectingProcessing && (!isInitialized || !isConnected || isErrorOccuredOnSearchService);

  return (
    <>
      <div className="row">
        <div className="col-md-12">
          <StatusTable
            isInitialized={isInitialized}
            isErrorOccuredOnSearchService={isErrorOccuredOnSearchService}
            isConnected={isConnected}
            isConfigured={isConfigured}
            isNormalized={isNormalized}
            indicesData={indicesData}
            aliasesData={aliasesData}
          />
        </div>
      </div>

      <hr />

      <div className="row">
        <label className="col-md-3 col-form-label text-left text-md-right">{t('full_text_search_management.reconnect')}</label>
        <div className="col-md-6">
          <ReconnectControls
            isEnabled={isReconnectBtnEnabled}
            isProcessing={isReconnectingProcessing}
            onReconnectingRequested={reconnect} />
        </div>
      </div>

      <hr />

      <div className="row">
        <label className="col-md-3 col-form-label text-left text-md-right">{t('full_text_search_management.normalize')}</label>
        <div className="col-md-6">
          <NormalizeIndicesControls
            isRebuildingProcessing={isRebuildingProcessing}
            isRebuildingCompleted={isRebuildingCompleted}
            isNormalized={isNormalized}
            onNormalizingRequested={normalizeIndices}
          />
        </div>
      </div>

      <hr />

      <div className="row">
        <label className="col-md-3 col-form-label text-left text-md-right">{t('full_text_search_management.rebuild')}</label>
        <div className="col-md-6">
          {/* TODO: GW-5134 SocketIoContainer 機能の swr 化 */}
          {/* GW-6820 [5134ブロック] ElasticsearchManagement/RebuildIndexControlsのFC化 */}
          {/* <RebuildIndexControls
            isRebuildingProcessing={isRebuildingProcessing}
            isRebuildingCompleted={isRebuildingCompleted}
            isNormalized={isNormalized}
            onRebuildingRequested={rebuildIndices}
          /> */}
        </div>
      </div>
    </>
  );
};

export default ElasticsearchManagement;
