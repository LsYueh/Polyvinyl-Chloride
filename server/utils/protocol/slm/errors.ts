export interface ISlmError {
    message: string;
    info?: string;
    suggestion: string;
}

export const SlmError: Record<string, ISlmError> = {
    '21': {
        message   : 'Framing Error',
        info      : 'Header或trailer錯誤，或是AP-Message Length與實際資料長度不合',
        suggestion: '證交所將會結束Socket，證券商可於排除狀況後，重新建立Socket Session。',
    },
    '22': {
        message   : '非授權 Source Port',
        suggestion: '證交所將會結束Socket，證券商檢查並更正Source Port Number後，重新建立Socket Session。',
    },
    '23': {
        message   : 'Heartbeat Timeout',
        suggestion: '證交所將會結束Socket，證券商可於排除狀況後，重新建立Socket Session。',
    },
    '24': {
        message   : 'Suspended by TSE',
        suggestion: '證交所拒絕接受該Socket的連線要求。請電話連絡證交所操管中心查明原因。',
    },
    '25': {
        message   : 'Invalid Frame',
        info      : '未定義的Control-code或Control-code=00但AP-Message-length=0或Control-code=11但AP-Message-length>0',
        suggestion: '證交所將會結束Socket，證券商可於排除狀況後，重新建立Socket Session。',
    },
    '26': {
        message   : 'Heartbeat次數太多',
        suggestion: '證交所將會結束Socket，並將拒絕接受該Socket的連線要求。證券商必須於排除狀況後，電話通知證交所操管中心解除設定，才可再重新建立Socket Session。',
    },
    '29': {
        message   : 'System Not Ready',
        info      : '證交所電腦軟硬體設備尚未啟動或發生異常',
        suggestion: '證交所將會結束Socket，證券商應等待一段時間後再重新嘗試建立Socket Session。',
    },
};
