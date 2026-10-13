// The status menu of the employee list. A plain module (no 'use client'), because the server page
// reads it too: a value exported from a 'use client' file reaches server code only as a reference
// to client code, not as the array itself.

/** "working" is the default (Active and Suspended); "all" adds those who left */
export const STATUS_CHOICES = [
  'working',
  'active',
  'suspended',
  'terminated',
  'all',
] as const;
export type StatusChoice = (typeof STATUS_CHOICES)[number];
