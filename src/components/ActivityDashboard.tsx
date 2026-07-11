import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, MessageSquare, Flame, TrendingUp } from 'lucide-react';
import { UserProfile } from '../types';

interface ActivityDashboardProps {
  profile: UserProfile;
  t: (key: string) => string;
  lang: string;
}

interface ActivityDataPoint {
  dayName: string;
  dayNameHe: string;
  dayNameAr: string;
  bridgePoints: number;
  debatesJoined: number;
}

export function ActivityDashboard({ profile, t, lang }: ActivityDashboardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const isRtl = lang === 'he' || lang === 'ar' || lang === 'yi';

  // Dynamic values derived from the user's profile to make the dashboard feel live
  const totalPoints = profile.bridgeBuilderPoints || 10;
  const debatesCount = Math.max(1, Math.floor(totalPoints / 12) + 1);
  const constructiveCount = Math.max(1, Math.floor(totalPoints / 8));
  const activeStreak = Math.max(2, (totalPoints % 6) + 1);

  // Generate a mock 7-day dataset where "Today" (the last element) is directly tied to user's real points
  const basePoints = [15, 5, 25, 10, 30, 15];
  const baseDebates = [1, 0, 2, 1, 3, 1];
  
  const daysOfWeek = [
    { en: 'Sun', he: 'א׳', ar: 'الأحد' },
    { en: 'Mon', he: 'ב׳', ar: 'الاثنين' },
    { en: 'Tue', he: 'ג׳', ar: 'الثلاثاء' },
    { en: 'Wed', he: 'ד׳', ar: 'الأربعاء' },
    { en: 'Thu', he: 'ה׳', ar: 'الخميس' },
    { en: 'Fri', he: 'ו׳', ar: 'الجمعة' },
    { en: 'Sat', he: 'שבת', ar: 'السبت' },
  ];

  // Rotate days so today is the last element
  const todayIndex = new Date().getDay();
  const data: ActivityDataPoint[] = Array.from({ length: 7 }).map((_, i) => {
    const dayOffset = (todayIndex - 6 + i + 7) % 7;
    const dayMeta = daysOfWeek[dayOffset];
    
    // Last element is today
    if (i === 6) {
      return {
        dayName: dayMeta.en,
        dayNameHe: dayMeta.he,
        dayNameAr: dayMeta.ar,
        bridgePoints: Math.max(5, totalPoints % 25),
        debatesJoined: Math.max(1, debatesCount % 3)
      };
    }

    return {
      dayName: dayMeta.en,
      dayNameHe: dayMeta.he,
      dayNameAr: dayMeta.ar,
      bridgePoints: basePoints[i] + (totalPoints % 7),
      debatesJoined: baseDebates[i]
    };
  });

  // Chart layout config (D3-style mapping coords)
  const chartWidth = 540;
  const chartHeight = 160;
  const paddingX = 40;
  const paddingY = 25;

  const maxPoints = Math.max(...data.map(d => d.bridgePoints), 40);
  const maxDebates = Math.max(...data.map(d => d.debatesJoined), 4);

  // Helper functions to convert data index & value to SVG coordinates
  const getX = (index: number) => {
    return paddingX + (index * (chartWidth - paddingX * 2)) / 6;
  };

  const getYPoints = (val: number) => {
    return chartHeight - paddingY - (val * (chartHeight - paddingY * 2)) / maxPoints;
  };

  const getYDebates = (val: number) => {
    return chartHeight - paddingY - (val * (chartHeight - paddingY * 2)) / maxDebates;
  };

  // Generate SVG path for the Points Area (smooth curve)
  let areaPath = '';
  let linePath = '';

  data.forEach((d, i) => {
    const x = getX(i);
    const y = getYPoints(d.bridgePoints);
    if (i === 0) {
      linePath = `M ${x} ${y}`;
      areaPath = `M ${x} ${chartHeight - paddingY} L ${x} ${y}`;
    } else {
      // Smooth cubic bezier calculation (D3 style approximation)
      const prevX = getX(i - 1);
      const prevY = getYPoints(data[i - 1].bridgePoints);
      const cpX1 = prevX + (x - prevX) / 2;
      const cpY1 = prevY;
      const cpX2 = prevX + (x - prevX) / 2;
      const cpY2 = y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
      areaPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
    }
    if (i === data.length - 1) {
      areaPath += ` L ${x} ${chartHeight - paddingY} Z`;
    }
  });

  const getDayLabel = (d: ActivityDataPoint) => {
    if (lang === 'he') return d.dayNameHe;
    if (lang === 'ar') return d.dayNameAr;
    return d.dayName;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white p-8 rounded-[32px] shadow-lg border border-ink/5 space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink/5 pb-6">
        <div>
          <h3 className="text-xl font-serif font-bold text-ink flex items-center gap-2">
            <TrendingUp className="text-primary animate-pulse" size={22} />
            {t('activityTitle')}
          </h3>
          <p className="text-ink/60 text-xs mt-1">
            {t('activityDesc')}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
          <span className="text-xs font-serif font-medium text-ink/60">{t('chartLegendBridges')}</span>
          <span className="w-3 h-3 rounded bg-primary/20 inline-block ml-3" />
          <span className="text-xs font-serif font-medium text-ink/60">{t('chartLegendDebates')}</span>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="bg-bg p-4 rounded-2xl border border-ink/5 hover:border-primary/20 transition-all group">
          <div className="text-[10px] font-black uppercase tracking-widest text-ink/40 mb-1">
            {t('statsBridgesBuilt')}
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="text-2xl font-serif font-black text-amber-600">
              {totalPoints}
            </div>
            <Award size={16} className="text-amber-500 fill-amber-500" />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-bg p-4 rounded-2xl border border-ink/5 hover:border-primary/20 transition-all group">
          <div className="text-[10px] font-black uppercase tracking-widest text-ink/40 mb-1">
            {t('statsDebatesJoined')}
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="text-2xl font-serif font-black text-primary">
              {debatesCount}
            </div>
            <MessageSquare size={16} className="text-primary/70" />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-bg p-4 rounded-2xl border border-ink/5 hover:border-primary/20 transition-all group">
          <div className="text-[10px] font-black uppercase tracking-widest text-ink/40 mb-1">
            {t('statsConstructiveContributions')}
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="text-2xl font-serif font-black text-sky">
              {constructiveCount}
            </div>
            <Award size={16} className="text-sky/70" />
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-bg p-4 rounded-2xl border border-ink/5 hover:border-primary/20 transition-all group">
          <div className="text-[10px] font-black uppercase tracking-widest text-ink/40 mb-1">
            {t('statsActiveStreak')}
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="text-2xl font-serif font-black text-red-600">
              {activeStreak}
            </div>
            <Flame size={16} className="text-red-500 fill-red-500 animate-bounce" />
          </div>
        </div>
      </div>

      {/* SVG Interactive Chart Section */}
      <div className="relative bg-bg/50 p-4 rounded-2xl border border-ink/5">
        <h4 className="text-xs font-serif font-black uppercase tracking-widest text-ink/40 mb-4 px-2">
          {t('chartWeeklyOverview')}
        </h4>

        <div className="w-full overflow-x-auto overflow-y-hidden scrollbar-none">
          <div className="min-w-[500px] h-[180px] relative">
            <svg 
              width="100%" 
              height="100%" 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              preserveAspectRatio="xMidYMid meet"
              className="overflow-visible"
            >
              <defs>
                {/* Modern Gradient Fill */}
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d97706" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1={paddingX} y1={getYPoints(0)} x2={chartWidth - paddingX} y2={getYPoints(0)} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
              <line x1={paddingX} y1={getYPoints(maxPoints / 2)} x2={chartWidth - paddingX} y2={getYPoints(maxPoints / 2)} stroke="rgba(0,0,0,0.03)" strokeDasharray="3,3" />
              <line x1={paddingX} y1={getYPoints(maxPoints)} x2={chartWidth - paddingX} y2={getYPoints(maxPoints)} stroke="rgba(0,0,0,0.03)" strokeDasharray="3,3" />

              {/* Debate Bars (Underneath the line) */}
              {data.map((d, i) => {
                const x = getX(i);
                const barWidth = 14;
                const h = (d.debatesJoined / maxDebates) * (chartHeight - paddingY * 2);
                const barY = chartHeight - paddingY - h;

                return (
                  <rect
                    key={`bar-${i}`}
                    x={x - barWidth / 2}
                    y={barY}
                    width={barWidth}
                    height={h}
                    rx="3"
                    className="fill-primary/20 group-hover:fill-primary/35 transition-colors"
                  />
                );
              })}

              {/* Area Under Points Line */}
              <path d={areaPath} fill="url(#areaGrad)" />

              {/* Smooth Points Line */}
              <path d={linePath} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />

              {/* Interactive Data Dots & Hover Hitbox Columns */}
              {data.map((d, i) => {
                const x = getX(i);
                const y = getYPoints(d.bridgePoints);

                return (
                  <g key={`point-${i}`} className="cursor-pointer">
                    {/* Active point indicator */}
                    <circle 
                      cx={x} 
                      cy={y} 
                      r={hoveredIndex === i ? 6 : 4} 
                      fill="#ffffff" 
                      stroke="#d97706" 
                      strokeWidth={hoveredIndex === i ? 3 : 2} 
                      className="transition-all duration-200"
                    />

                    {/* Invisible Hitbox rect for easier mouse hovering */}
                    <rect
                      x={x - (chartWidth - paddingX * 2) / 12}
                      y={0}
                      width={(chartWidth - paddingX * 2) / 6}
                      height={chartHeight}
                      fill="transparent"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  </g>
                );
              })}

              {/* X Axis Day Labels */}
              {data.map((d, i) => {
                const x = getX(i);
                return (
                  <text
                    key={`label-${i}`}
                    x={x}
                    y={chartHeight - 6}
                    textAnchor="middle"
                    className="fill-ink/40 text-[10px] font-sans font-bold"
                  >
                    {getDayLabel(d)}
                  </text>
                );
              })}
            </svg>

            {/* Absolute Hover Tooltip */}
            <AnimatePresence>
              {hoveredIndex !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute bg-white p-3 rounded-xl shadow-xl border border-ink/5 text-xs z-30 pointer-events-none flex flex-col gap-1 font-sans"
                  style={{
                    left: `${(getX(hoveredIndex) / chartWidth) * 100}%`,
                    top: '20px',
                    transform: isRtl ? 'translateX(50%)' : 'translateX(-50%)',
                  }}
                >
                  <div className="font-bold border-b border-ink/5 pb-1 text-ink/70">
                    {getDayLabel(data[hoveredIndex])}
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-700">
                    <Award size={12} className="fill-amber-500 text-amber-500" />
                    <span>+{data[hoveredIndex].bridgePoints} {t('bridgeBuilderScore')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-primary">
                    <MessageSquare size={12} />
                    <span>{data[hoveredIndex].debatesJoined} {t('chartLegendDebates')}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
