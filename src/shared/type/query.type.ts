export type HourQuery = { Querystring: { hour?: string } };
export type DateQuery = { Querystring: { date?: string } };
export type MonthQuery = { Querystring: { month?: string } };
export type HostQuery = { Querystring: { host: string } };
export type HourHostQuery = { Querystring: { hour?: string; host: string } };
export type DateHostQuery = { Querystring: { date?: string; host: string } };
export type MonthHostQuery = { Querystring: { month?: string; host: string } };
