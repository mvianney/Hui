'use client';

import React, { useState, useEffect } from 'react';

interface CountdownProps {
  targetDate: string;
  label?: string;
  onExpired?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function Countdown({ targetDate, label, onExpired }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        setIsExpired(true);
        onExpired?.();
        return null;
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      if (!newTimeLeft) {
        clearInterval(timer);
      } else {
        setTimeLeft(newTimeLeft);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onExpired]);

  if (isExpired) {
    return (
      <div className="flex flex-col items-center">
        {label && <span className="text-sm font-medium text-hui-text-secondary mb-2">{label}</span>}
        <div className="text-hui-error font-medium px-4 py-2 bg-hui-error-light rounded-xl">Expired</div>
      </div>
    );
  }

  if (!timeLeft) {
    return null; // Initial render before hydration
  }

  const TimeBox = ({ value, unit }: { value: number; unit: string }) => (
    <div className="flex flex-col items-center mx-1">
      <div className="w-12 h-12 flex items-center justify-center bg-white border border-hui-border rounded-lg text-lg font-bold text-hui-text shadow-sm">
        {value.toString().padStart(2, '0')}
      </div>
      <span className="text-[10px] uppercase font-medium text-hui-text-tertiary mt-1">{unit}</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center">
      {label && <span className="text-sm font-medium text-hui-text-secondary mb-2">{label}</span>}
      <div className="flex items-center">
        <TimeBox value={timeLeft.days} unit="Days" />
        <span className="text-hui-text-tertiary text-xl font-bold pb-4">:</span>
        <TimeBox value={timeLeft.hours} unit="Hrs" />
        <span className="text-hui-text-tertiary text-xl font-bold pb-4">:</span>
        <TimeBox value={timeLeft.minutes} unit="Min" />
        <span className="text-hui-text-tertiary text-xl font-bold pb-4">:</span>
        <TimeBox value={timeLeft.seconds} unit="Sec" />
      </div>
    </div>
  );
}
