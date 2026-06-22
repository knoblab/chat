let timeOffset = 0;
let isSynced = false;

export const syncServerTime = async (): Promise<number> => {
  const start = Date.now();
  try {
    const res = await fetch(`/?_ts=${start}`, { method: 'HEAD' });
    const dateHeader = res.headers.get('Date');
    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      const end = Date.now();
      const latency = (end - start) / 2;
      timeOffset = (serverTime + latency) - end;
      isSynced = true;
      console.log(`[TimeSync] Server time synced successfully. Offset: ${timeOffset}ms`);
      return timeOffset;
    }
  } catch (e) {
    console.warn('[TimeSync] HEAD request failed. Trying GET...', e);
    try {
      const res = await fetch(`/?_ts=${start}`, { method: 'GET' });
      const dateHeader = res.headers.get('Date');
      if (dateHeader) {
        const serverTime = new Date(dateHeader).getTime();
        const end = Date.now();
        const latency = (end - start) / 2;
        timeOffset = (serverTime + latency) - end;
        isSynced = true;
        console.log(`[TimeSync] Server time synced successfully via GET. Offset: ${timeOffset}ms`);
        return timeOffset;
      }
    } catch (e2) {
      console.error('[TimeSync] Server time sync failed completely.', e2);
    }
  }
  return timeOffset;
};

export const getSyncedDate = (): Date => {
  return new Date(Date.now() + timeOffset);
};

export const getKSTTimeInfo = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });
  const parts = formatter.formatToParts(date);
  const hourVal = parts.find(p => p.type === 'hour')?.value || '0';
  const minuteVal = parts.find(p => p.type === 'minute')?.value || '0';
  const secondVal = parts.find(p => p.type === 'second')?.value || '0';
  
  const hour = parseInt(hourVal, 10) % 24;
  const minute = parseInt(minuteVal, 10);
  const second = parseInt(secondVal, 10);
  return { hour, minute, second };
};

/**
 * Checks if the given date (translated to KST) is in maintenance mode.
 * Maintenance window: 23:55 to 24:10 (00:10 of the next day).
 */
export const checkMaintenanceActive = (date: Date): boolean => {
  // Query param check for testing purposes
  const params = new URLSearchParams(window.location.search);
  if (params.get('mock_maintenance') === 'true') {
    return true;
  }

  const { hour, minute } = getKSTTimeInfo(date);
  
  // 23:55 ~ 23:59
  if (hour === 23 && minute >= 55) {
    return true;
  }
  // 00:00 ~ 00:09
  if (hour === 0 && minute < 10) {
    return true;
  }
  return false;
};

/**
 * Calculates remaining seconds until maintenance mode ends.
 * Since maintenance ends at 00:10 KST, we find the next 00:10 KST.
 */
export const getSecondsUntilMaintenanceEnd = (date: Date): number => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mock_maintenance') === 'true') {
    // If mock maintenance is active, mock a 15-minute countdown (900 seconds)
    // that counts down relative to current minutes/seconds.
    const mockSecs = 900 - ((date.getMinutes() * 60 + date.getSeconds()) % 900);
    return mockSecs;
  }

  if (!checkMaintenanceActive(date)) {
    return 0;
  }

  const { hour, minute, second } = getKSTTimeInfo(date);
  
  let targetMinutes = 0;
  if (hour === 23) {
    // It's 23:55 ~ 23:59.
    // Time until 24:00 (midnight) is (60 - minute - 1) minutes + (60 - second) seconds.
    // Plus 10 minutes until 00:10.
    targetMinutes = (60 - minute - 1) + 10;
    return targetMinutes * 60 + (60 - second);
  } else if (hour === 0) {
    // It's 00:00 ~ 00:09.
    // Time until 00:10 is (10 - minute - 1) minutes + (60 - second) seconds.
    targetMinutes = 10 - minute - 1;
    return targetMinutes * 60 + (60 - second);
  }
  return 0;
};
