import * as configRepo from "../../db/repositories/configRepo.js";

export const configGetCommand = (key) => {
  if (key) {
    console.log(configRepo.get(key));
  } else {
    console.log(configRepo.getAll());
  }
};
