/**
 * 訊息代號歸屬
 */
export enum Ownership {
  Unknown = -1,
  All = 0, // 所有訊息
  Fxx0,    // Fxx0表示xx為02，04，06，...，16等回覆訊息
  F030,
  L010,
}

export interface ITmpError {
  message: string;
  ownership: Ownership;
  info?: string;
  suggestion: string;
}

/**
 * 單筆訊息與檔案傳輸子系統錯誤訊息
 */
export const TmpBaseError: Record<string, ITmpError> = {
  '00': {
    message: 'normal response',
    ownership: Ownership.All,
    suggestion: '繼續下一個作業',
  },
  '10': {
    message: 'illegal file code',
    ownership: Ownership.Fxx0,
    info: '收到之訊息中之file code欄位值不正確',
    suggestion: '回到傳輸子系統之開頭',
  },
  '11': {
    message: 'illegal EOF value',
    ownership: Ownership.Fxx0,
    info: '收到之訊息中之EOF欄位值不正確',
    suggestion: '回到傳輸子系統之開頭',
  },
  '12': {
    message: 'illegal file size',
    ownership: Ownership.Fxx0,
    info: '收到之總資料訊息長度與起始訊息中file size不符合',
    suggestion: '回到傳輸子系統之開頭',
  },
  '13': {
    message: 'timing error',
    ownership: Ownership.Fxx0,
    info: '收到之訊息出現在規定之作業時間之外',
    suggestion: '回到傳輸子系統之開頭',
  },
  '14': {
    message: 'file is not ready',
    ownership: Ownership.Fxx0,
    suggestion: '所要求之檔案尚未完成',
  },
  '17': {
    message: 'file is ready but empty',
    ownership: Ownership.Fxx0,
    suggestion: '所要求之檔案為空檔，繼續下一個作業',
  },
  '19': {
    message: 'abort by initiator',
    ownership: Ownership.F030,
    suggestion: '回到傳輸子系統之開頭',
  },
  '20': {
    message: 'busy now, resend later',
    ownership: Ownership.Fxx0,
    suggestion: '系統忙碌中，傳輸代號B、C開頭作業請稍後再傳送',
  },
  '79': {
    message: 'duplicate access repuest',
    ownership: Ownership.All,
    suggestion: '上次要求尚未處理完畢，繼續下一個作業',
  },
  '81': {
    message: 'illegal subsystem name',
    ownership: Ownership.All,
    suggestion: '回到連線子系統',
  },
  '82': {
    message: 'illegal function code',
    ownership: Ownership.All,
    suggestion: '回到連線子系統',
  },
  '83': {
    message: 'illegal message type',
    ownership: Ownership.All,
    suggestion: '回到連線子系統',
  },
  '84': {
    message: 'illegal message time',
    ownership: Ownership.All,
    suggestion: '回到連線子系統',
  },
  '85': {
    message: 'illegal status code',
    ownership: Ownership.All,
    suggestion: '回到連線子系統',
  },
  '86': {
    message: 'illegal cource id',
    ownership: Ownership.All,
    suggestion: '回到連線子系統',
  },
  '87': {
    message: 'illegal object id',
    ownership: Ownership.All,
    suggestion: '回到連線子系統',
  },
  '88': {
    message: 'illegal body length',
    ownership: Ownership.All,
    suggestion: '回到連線子系統',
  },
  '89': {
    message: 'internal error',
    ownership: Ownership.All,
    info: '主機系統發生無法處理情形',
    suggestion: '回到連線子系統',
  },
  '92': {
    message: 'FT count error',
    ownership: Ownership.All,
    info: '累計錯誤次數超過限制',
    suggestion: '回到連線子系統',
  },
  '93': {
    message: 'repuest count error',
    ownership: Ownership.All,
    info: '傳輸某特定檔案之次數超過限制',
    suggestion: '回到連線子系統',
  },
  '99': {
    message: 'CALL COMPUTER CENTER',
    ownership: Ownership.L010,
    suggestion: '請打電話到證交所詢問',
  },
};

/**
 * 委託
 */
export const TmpOrderError: Record<string, ITmpError> = {
  '86': {
    message: '今日不得交易',
    ownership: Ownership.Unknown,
    suggestion: '',
  },
  '89': {
    message: '委託資料錯誤次數超過限制',
    ownership: Ownership.Unknown,
    info: '此PVC停止作業',
    suggestion: '聯絡證交所電腦操管人員解除設定',
  },
  '91': {
    message: 'TIME OUT',
    ownership: Ownership.Unknown,
    info: '未收到證券商傳送之訊息',
    suggestion: '',
  },
  '92': {
    message: 'MSG LENGTH ERR',
    ownership: Ownership.Unknown,
    info: '訊息長度不對',
    suggestion: '',
  },
  '94': {
    message: 'RCV/SND MSG ERR',
    ownership: Ownership.Unknown,
    info: '送/收訊息不成功，線路問題',
    suggestion: '',
  },
  '95': {
    message: 'UNKNOW MESSAGE',
    ownership: Ownership.Unknown,
    info: '收到傳來之不明訊息',
    suggestion: '',
  },
};

/**
 * 成交
 */
export const TmpMatchError: Record<string, ITmpError> = {
  '91': {
    message: 'TIME OUT',
    ownership: Ownership.Unknown,
    info: '未收到證券商傳送之訊息',
    suggestion: '',
  },
  '92': {
    message: 'MSG LENGTH ERR',
    ownership: Ownership.Unknown,
    info: '訊息長度不對',
    suggestion: '',
  },
  '94': {
    message: 'RCV/SND MSG ERR',
    ownership: Ownership.Unknown,
    info: '送/收訊息不成功，線路問題',
    suggestion: '',
  },
  '95': {
    message: 'UNKNOW MESSAGE',
    ownership: Ownership.Unknown,
    info: '收到傳來之不明訊息',
    suggestion: '',
  },
};
