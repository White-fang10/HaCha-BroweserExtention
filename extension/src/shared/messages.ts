export type HaChaMessage =
    | { type: "ACTIVATE_HACHA" }
    | { type: "DEACTIVATE_HACHA" }
    | { type: "GET_STATUS" };
