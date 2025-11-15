import { withLock } from "../../utils/fileStorage.js";

const file = "config.json";

export const get = (key) => {
  return withLock(file, (data) => {
    return data ? data[key] : undefined;
  });
};

export const set = (key, value) => {
  return withLock(file, (data) => {
    data[key] = value;
    return data;
  });
};

export const getAll = () => {
  return withLock(file, (data) => data || {});
};