"use client";

import { useSyncExternalStore } from "react";

/**
 * Công tắc "giảm chuyển động" của khách trên thiệp (ngoài cài đặt hệ thống prefers-reduced-motion).
 * Nhớ theo trình duyệt của khách; lỗi lưu trữ (Zalo, chế độ riêng tư) thì chỉ nhớ trong phiên.
 */
const KEY = "trao:fx-calm";
const listeners = new Set<() => void>();
let calm: boolean | null = null;

function read() {
  if (calm !== null) return calm;
  try {
    calm = localStorage.getItem(KEY) === "1";
  } catch {
    calm = false;
  }
  return calm;
}

export function setCalm(v: boolean) {
  calm = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* bỏ qua */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", l);
  return () => {
    listeners.delete(l);
    mq.removeEventListener("change", l);
  };
}

/** true khi hệ thống yêu cầu giảm chuyển động hoặc khách tự tắt chuyển động. */
export function reducedNow() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || read();
}

export function useCalm() {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, reducedNow, () => false);
}
