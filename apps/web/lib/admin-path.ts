/**
 * 後台基底路徑。集中在這裡：之後要把後台藏在隨機碼後面（防掃描），
 * 只改這一個常數 + middleware 的 rewrite，其餘連結都吃這個值。
 *
 * 現在先固定 /admin。
 */
export const ADMIN_BASE = '/admin'
