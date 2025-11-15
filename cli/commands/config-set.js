import * as configRepo from "../../db/repositories/configRepo.js";

export const configSetCommand = (key, value) => {
  configRepo.set(key, value);
  console.log(`⚙️ Config updated: ${key} = ${value}`);
};
