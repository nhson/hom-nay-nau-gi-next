import { EMPTY_PERSONAL_STATE, normalizePersonalState, type PersonalState } from "@/domain";
import { idbGet, idbSet } from "./idb";

const KEY = "personal";

/** Always resolves to a valid state: missing, older or corrupt data is normalized away. */
export async function loadPersonal(): Promise<PersonalState> {
  try {
    return normalizePersonalState(await idbGet(KEY));
  } catch {
    return EMPTY_PERSONAL_STATE;
  }
}

export function savePersonal(state: PersonalState): Promise<boolean> {
  return idbSet(KEY, state);
}
