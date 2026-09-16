/**
 * Ported from sikkumPigisha's src/lib/monday/index.ts. `agents.ts` is
 * deliberately NOT ported — the owner-agent/buyer-agent colleague picker
 * uses agentLedger's own `listAgentsByOffice` instead of a Daf Kesher
 * lookup (Phase 8b). Everything else here talks to the same Monday boards
 * (Properties Raw Data, Deals_Raw_Data, Signed Contracts, Contacts, Offers)
 * sikkumPigisha always did, unchanged.
 */
export { getPropertiesBoardId, getDealsBoardId, getAgentsBoardId } from "../../monday/client";
export {
  listPropertiesForAgent,
  getPropertyForAgent,
  getPropertyCommissionPrefill,
  setPropertyListingStatus,
} from "./properties";
export {
  listClientsForAgent,
  listSellersForAgent,
  listSellersWithCommissionForAgent,
  listSellersForPropertyWizard,
  listBuyersWithCommissionForAgent,
  notifyClientSelected,
  writeBackClients,
  getSignedContractFile,
} from "./clients";
export type { ClientWriteBackPerson, PropertyContractSummary } from "./clients";
export { listOffersForAgent, setOfferStatus } from "./offers";
export { createDealItem } from "./deals";
export {
  MondayApiError,
  MondayConfigError,
  MondayOwnershipError,
} from "../../monday/errors";
export { PROPERTIES_BOARD, AGENTS_BOARD, STATUS_LABELS } from "./columns";
export type {
  Agent,
  PropertySummary,
  PropertyDetails,
  PropertyCommissionPrefill,
  ClientSummary,
  ClientCommissionSummary,
  OfferSummary,
  ColumnValue,
  RawItem,
} from "./types";
export type { DealType, DocLanguage, CommunicationLang } from "./columns";
