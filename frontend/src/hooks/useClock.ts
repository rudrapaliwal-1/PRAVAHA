import { useState, useEffect } from 'react';

export interface ClockState {
  utcTime: string;
  localTime: string;
  dateStr: string;
  isoString: string;
}

export function useClock(): ClockState {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTwo = (num: number) => num.toString().padStart(2, '0');

  const utcHours = formatTwo(time.getUTCHours());
  const utcMinutes = formatTwo(time.getUTCMinutes());
  const utcSeconds = formatTwo(time.getUTCSeconds());
  const utcTime = `${utcHours}:${utcMinutes}:${utcSeconds} UTC`;

  const localHours = formatTwo(time.getHours());
  const localMinutes = formatTwo(time.getMinutes());
  const localSeconds = formatTwo(time.getSeconds());
  const localTime = `${localHours}:${localMinutes}:${localSeconds} LOC`;

  const dateStr = time.toISOString().split('T')[0];

  return {
    utcTime,
    localTime,
    dateStr,
    isoString: time.toISOString(),
  };
}
