import axios from "axios";
import * as jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
import * as moment from "moment-timezone";
import { LogLevel, logger as pinoLogger, PinoLogger } from "./logger";

dotenv.config();

let bearerToken: string | null = null;
const logger = new PinoLogger(pinoLogger, LogLevel.trace);

export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token, { complete: true, json: true }) as any;
    if (decoded && decoded.payload && decoded.payload.exp) {
      const exp = moment.unix(decoded.payload.exp).utc();
      if (exp.isBefore(moment.utc())) {
        return true;
      }
      return false;
    }
    return true;
  } catch (e) {
    logger.error(`An error occurred: ${e}`);
    return true;
  }
};

export const fetchBearerToken = async (): Promise<string | null> => {
  if (bearerToken && !isTokenExpired(bearerToken)) {
    logger.info("Found existing unexpired bearer token, returning it");
    return bearerToken;
  }

  const baseUrl = process.env.TRACTION_BASE_URL;
  const tenantId = process.env.TRACTION_TENANT_ID;
  const apiKey = process.env.TRACTION_TENANT_API_KEY;
  const endpoint = `multitenancy/tenant/${tenantId}/token`;
  const url = new URL(endpoint, baseUrl).toString();
  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
  };
  const data = { api_key: apiKey };

  logger.info(`Requesting bearer token for walletId ${tenantId}`);

  try {
    const response = await axios.post(url, data, { headers });
    if (response.status === 200) {
      logger.info("Token fetched successfully");
      bearerToken = response.data.token;
      if (!bearerToken) {
        logger.error("Token doesn't exist in response data");
      }
      return bearerToken;
    } else {
      logger.error(`Error fetching token: ${response.status}`);
      logger.error(`Text content for error: ${response.data}`);
    }
  } catch (error) {
    logger.error(`Error fetching token: ${error}`);
  }
  return null;
};

export const getConnection = async (connId: string): Promise<any> => {
  const baseUrl = process.env.TRACTION_BASE_URL;
  const endpoint = `/connections/${connId}`;
  const url = new URL(endpoint, baseUrl).toString();

  const token = await fetchBearerToken();
  if (!token) return null;

  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  logger.info(`Fetching connection ${connId}`);

  try {
    const response = await axios.get(url, { headers });
    if (response.status === 200) {
      logger.info("Connection fetched successfully");
      return response.data;
    } else {
      logger.error(`Error fetching connection message: ${response.status}`);
      logger.error(`Text content for error: ${response.data}`);
    }
  } catch (error) {
    logger.error(`Error fetching connection: ${error}`);
  }

  return null;
};

export const sendDrpcResponse = async (
  connId: string,
  threadId: string,
  response: any
) => {
  const endpoint = `/drpc/${connId}/response`;
  const message = { response, thread_id: threadId };
  logger.info(
    `Sending response to ${connId}, message = ${JSON.stringify(message)}`
  );

  await sendGenericMessage(connId, endpoint, message);
};

export const sendDrpcRequest = async (connId: string, request: any) => {
  const endpoint = `/drpc/${connId}/request`;
  const message = { request };
  await sendGenericMessage(connId, endpoint, message);
};

export const sendGenericMessage = async (
  connId: string,
  endpoint: string,
  message: any
) => {
  const baseUrl = process.env.TRACTION_BASE_URL;
  const url = new URL(endpoint, baseUrl).toString();

  const token = await fetchBearerToken();
  if (!token) return;

  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  logger.info(`Sending message to ${connId}, message = ${endpoint}`);

  try {
    const response = await axios.post(url, message, { headers });
    if (response.status === 200) {
      logger.info("Message sent successfully");
    } else {
      logger.error(
        `Error sending message: ${response.status} ${response.data}`
      );
    }
  } catch (error) {
    logger.error(`Error sending message: ${error}`);
  }
};

export const offerCredential = async (offer: any) => {
  logger.info("issue_attestation_credential");

  const baseUrl = process.env.TRACTION_BASE_URL;
  const endpoint = "/issue-credential/send-offer";
  const url = new URL(endpoint, baseUrl).toString();

  const token = await fetchBearerToken();
  if (!token) return;

  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  logger.info(
    `Sending offer to ${offer["connection_id"]}, offer = ${JSON.stringify(
      offer
    )}`
  );

  try {
    const response = await axios.post(url, offer, { headers });
    if (response.status === 200) {
      logger.info("Offer sent successfully");
    } else {
      logger.error(`Error sending offer: ${response.status}`);
      logger.error(`Text content for error: ${response.data}`);
    }
  } catch (error) {
    logger.error(`Error sending offer: ${error}`);
  }
};

export const getSchema = async (schemaId: string): Promise<any> => {
  logger.info("get_schema");

  const baseUrl = process.env.TRACTION_BASE_URL;
  const endpoint = "/schemas/created";
  const url = new URL(endpoint, baseUrl).toString();

  const token = await fetchBearerToken();
  if (!token) return null;

  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    const response = await axios.get(url, {
      headers,
      params: { schema_id: schemaId },
    });
    if (response.status === 200) {
      logger.info("Schema queried successfully");
      return response.data;
    } else {
      logger.error(`Error querying schema: ${response.status}`);
      logger.error(`Text content for error: ${response.data}`);
    }
  } catch (error) {
    logger.error(`Error querying schema: ${error}`);
  }

  return null;
};

export const getCredDef = async (schemaId: string): Promise<any> => {
  logger.info("get_cred_def");

  const baseUrl = process.env.TRACTION_BASE_URL;
  const endpoint = "/credential-definitions/created";
  const url = new URL(endpoint, baseUrl).toString();

  const token = await fetchBearerToken();
  if (!token) return null;

  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    const response = await axios.get(url, {
      headers,
      params: { schema_id: schemaId },
    });
    if (response.status === 200) {
      logger.info("Cred def queried successfully");
      return response.data;
    } else {
      logger.error(`Error querying cred def: ${response.status}`);
      logger.error(`Text content for error: ${response.data}`);
    }
  } catch (error) {
    logger.error(`Error querying cred def: ${error}`);
  }

  return null;
};

export const createSchema = async (
  schemaName: string,
  schemaVersion: string,
  attributes: string[]
): Promise<any> => {
  logger.info("create_schema");

  const baseUrl = process.env.TRACTION_BASE_URL;
  const endpoint = "/schemas";
  const url = new URL(endpoint, baseUrl).toString();

  const token = await fetchBearerToken();
  if (!token) return null;

  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  const schema = {
    schema_name: schemaName,
    schema_version: schemaVersion,
    attributes: attributes,
  };

  try {
    const response = await axios.post(url, schema, { headers });
    if (response.status === 200) {
      logger.info("Schema created successfully");
      return response.data;
    } else {
      logger.error(`Error creating schema: ${response.status}`);
      logger.error(`Text content for error: ${response.data}`);
    }
  } catch (error) {
    logger.error(`Error creating schema: ${error}`);
  }

  return null;
};

export const createCredDef = async (
  schemaId: string,
  tag: string,
  revocationRegistrySize: number = 0
): Promise<any> => {
  logger.info("create_cred_def");

  const baseUrl = process.env.TRACTION_BASE_URL;
  const endpoint = "/credential-definitions";
  const url = new URL(endpoint, baseUrl).toString();

  const token = await fetchBearerToken();
  if (!token) return null;

  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  const payload: any = {
    schema_id: schemaId,
    tag: tag,
    support_revocation: revocationRegistrySize > 0,
  };

  if (revocationRegistrySize > 0) {
    payload.revocation_registry_size = revocationRegistrySize;
  }

  try {
    const response = await axios.post(url, payload, { headers });
    if (response.status === 200) {
      logger.info("Request sent successfully");
      return response.data;
    } else {
      logger.error(`Error creating request: ${response.status}`);
      logger.error(`Text content for error: ${response.data}`);
    }
  } catch (error) {
    logger.error(`Error creating request: ${error}`);
  }

  return null;
};

export const createPresentationRequest = async (
  presentationData: any
): Promise<any> => {
  logger.info("create_presentation_request");

  const baseUrl = process.env.TRACTION_BASE_URL;
  const endpoint = "/present-proof-2.0/create-request";
  const url = new URL(endpoint, baseUrl).toString();

  const token = await fetchBearerToken();
  if (!token) return null;

  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  logger.info(
    `Creating presentation request = ${JSON.stringify(presentationData)}`
  );

  try {
    const response = await axios.post(url, presentationData, { headers });
    if (response.status === 200) {
      logger.info("Request creation successfully");
      return response.data;
    } else {
      logger.error(`Error creating request: ${response.status}`);
      logger.error(`Text content for error: ${response.data}`);
    }
  } catch (error) {
    logger.error(`Error creating request: ${error}`);
  }

  return null;
};

export const sendPresentationRequest = async (request: any): Promise<any> => {
  logger.info("send_presentation_request");

  const baseUrl = process.env.TRACTION_BASE_URL;
  const endpoint = "/present-proof-2.0/send-request";
  const url = new URL(endpoint, baseUrl).toString();

  const token = await fetchBearerToken();
  if (!token) return null;

  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  logger.info(`Sending presentation request = ${JSON.stringify(request)}`);

  try {
    const response = await axios.post(url, request, { headers });
    if (response.status === 200) {
      logger.info("Request sent successfully");
      return response.data;
    } else {
      logger.error(`Error sending request: ${response.status}`);
      logger.error(`Text content for error: ${response.data}`);
    }
  } catch (error) {
    logger.error(`Error sending request: ${error}`);
  }

  return null;
};

export const createOobInvitation = async (
  label: string,
  goalCode?: string,
  attachments?: []
): Promise<any> => {
  logger.info("create_oob_invitation");

  const baseUrl = process.env.TRACTION_BASE_URL;
  const endpoint = "/out-of-band/create-invitation";
  const url = new URL(endpoint, baseUrl).toString();

  const token = await fetchBearerToken();
  if (!token) return null;

  const headers = {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  // logger.info(`Sending presentation request = ${JSON.stringify(request)}`);

  const request = {
    attachments,
    label: label,
    goal_code: goalCode,
    use_public_did: false,
    handshake_protocols: ["https://didcomm.org/connections/1.0"],
    //handshake_protocols:['https://didcomm.org/connections/1.0', 'https://didcomm.org/didexchange/1.0'],
  };

  logger.info(`Sending presentation request = ${JSON.stringify(request)}`);

  try {
    const response = await axios.post(url, request, {
      headers,
    });
    if (response.status === 200) {
      logger.info("Request sent successfully");
      return response.data;
    } else {
      logger.error(`Error sending request: ${response.status}`);
      logger.error(`Text content for error: ${response.data}`);
    }
  } catch (error) {
    logger.error(`Error sending request: ${error}`);
  }
};
