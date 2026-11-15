import { SVGProps } from 'react'

/** Small hand-drawn line-icon set (24px grid, stroke = currentColor). No icon dependency. */
const paths: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  quote: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h5',
  orders: 'M4 6h16M4 12h16M4 18h10M18 16l2 2-2 2',
  invoice: 'M6 3h9l4 4v14H6zM15 3v4h4M9 11h7M9 15h7M9 7h3',
  returns: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  credit: 'M3 7h18v10H3zM3 11h18M7 15h3',
  recurring: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
  cart: 'M3 4h2l2.5 11h11L21 7H7M9 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01',
  payment: 'M3 7h18v12H3zM3 11h18M16 15h2',
  expense: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h4',
  bank: 'M3 10h18L12 4zM5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
  box: 'M12 3 3 7.5v9L12 21l9-4.5v-9zM3 7.5 12 12l9-4.5M12 12v9',
  ledger: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6',
  reports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  truck: 'M2 6h12v10H2zM14 10h4l4 3v3h-8M6 19a2 2 0 1 0 0-.01M18 19a2 2 0 1 0 0-.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z',
  voucher: 'M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM10 6v12',
  building: 'M4 21V5l8-2v18M12 21V9l8 2v10M2 21h20M7 8h2M7 12h2M7 16h2M15 14h2M15 17h2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01',
  chevronDown: 'm6 9 6 6 6-6',
  chevronLeft: 'm15 18-6-6 6-6',
  chevronRight: 'm9 18 6-6-6-6',
  chevronsLeft: 'm11 17-5-5 5-5M18 17l-5-5 5-5',
  chevronsRight: 'm13 17 5-5-5-5M6 17l5-5-5-5',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  sort: 'M8 9l4-4 4 4M8 15l4 4 4-4',
  export: 'M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 7',
  check: 'M5 12l4 4 10-10',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  alert: 'M12 3 2 20h20zM12 10v4M12 17v.01',
  x: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 6h16M4 12h16M4 18h16',
  logout: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
  barChart: 'M5 20V12M10 20V6M15 20v-9M20 20V4',
  pieChart: 'M12 3v9h9a9 9 0 1 1-9-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  file: 'M6 3h9l4 4v14H6zM15 3v4h4',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
}
export type IconName = keyof typeof paths

export function Icon({ name, size = 18, strokeWidth = 1.8, ...p }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
      <path d={paths[name]} />
    </svg>
  )
}
