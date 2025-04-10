import { TCItem, TCPropertyInfo, TCSearchResponse, TCObject, TCSession } from './types.js';
import logger from '../logger.js';

// Parse the JSON response based on the service and operation
export const parseJSONResponse = (service: string, operation: string, response: Record<string, unknown>): unknown => {
  const parserRequestId = `parser_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  logger.debug(`[${parserRequestId}] Parsing response for ${service}.${operation}`);
  
  // Handle different API responses based on the service and operation
  if (service === 'Core-2006-03-Session' && operation === 'login') {
    logger.debug(`[${parserRequestId}] Parsing legacy login response`);
    // Handle legacy login response
    const userId = response['userId'] as string || '';
    const userName = response['userName'] as string || '';
    const group = response['group'] as string || '';
    const role = response['role'] as string || '';
    const sessionId = response['sessionId'] as string || '';
    const locale = response['locale'] as string || '';
    
    const sessionObject: TCSession = {
      userId,
      userName,
      group,
      role,
      sessionId,
      locale,
      groupId: '',
      groupName: '',
      roleId: '',
      roleName: '',
      status: 'OK',
      soaVersion: '12.0',
      serverInfo: undefined
    };
    
    logger.debug(`[${parserRequestId}] Parsed legacy login response for user: ${userId}`);
    return sessionObject;
  }
  
  // Parse based on the operation
  if (service === 'Core-2011-06-Session' && operation === 'login') {
    logger.debug(`[${parserRequestId}] Parsing new login response format`);
    // Handle the new login response format
    // First, ensure the response is in the expected format
    const loginResponseObj = response as Record<string, any>;
    
    // Extract user information from serverInfo
    const sessionObject: TCSession = {
      userId: loginResponseObj.serverInfo?.UserID || '',
      userName: loginResponseObj.serverInfo?.UserID || '',
      group: '',
      role: '',
      groupId: '',
      groupName: '',
      roleId: '',
      roleName: '',
      sessionId: loginResponseObj.serverInfo?.TcServerID || '',
      locale: loginResponseObj.serverInfo?.Locale || '',
      status: 'OK',
      soaVersion: loginResponseObj.serverInfo?.Version || '',
      serverInfo: loginResponseObj.serverInfo
    };
    
    logger.debug(`[${parserRequestId}] Parsed new login response for user: ${sessionObject.userId}`);
    return sessionObject;
  }
  
  if ((service === 'Core-2007-06-Session' || service === 'Core-2008-06-Session') && operation === 'logout') {
    logger.debug(`[${parserRequestId}] Parsing logout response`);
    // Handle logout response, typically just return success
    return { status: 'OK' };
  }
  
  if (service === 'Query-2012-10-Finder' && operation === 'performSearch') {
    // For search operations, parse the search results
    const searchResponseObj = response as Record<string, any>;
    
    // Extract the relevant information from the response
    const searchResults = searchResponseObj.searchResults || [];
    
    const searchResponse: TCSearchResponse = {
      searchResults: searchResults.map((obj: any) => ({
        uid: obj.uid || '',
        type: obj.type || '',
        properties: obj.props || obj.properties || {}
      })),
      totalFound: searchResponseObj.totalFound || searchResults.length,
      totalLoaded: searchResponseObj.totalLoaded || searchResults.length,
      searchFilterMap: searchResponseObj.searchFilterMap,
      searchFilterCategories: searchResponseObj.searchFilterCategories,
      defaultFilterFieldDisplayCount: searchResponseObj.defaultFilterFieldDisplayCount,
      serviceData: searchResponseObj.serviceData,
      // Keep objects for backward compatibility
      objects: searchResults.map((obj: any) => ({
        uid: obj.uid || '',
        type: obj.type || '',
        properties: obj.props || obj.properties || {}
      }))
    };
    
    logger.debug(`[${parserRequestId}] Parsed search response with ${searchResponse.totalFound} results`);
    return searchResponse;
  }
  
  // Default response handling for unimplemented operations
  logger.warn(`[${parserRequestId}] Unimplemented JSON response parsing for service: ${service}.${operation}`);
  return response;
};

// Convert a Teamcenter API object to a standardized TCObject
export const convertToTCObject = (itemObj: TCItem): TCObject => {
  const convertRequestId = `convert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  logger.debug(`[${convertRequestId}] Converting Teamcenter item to TCObject: ${itemObj.uid}`);
  
  // Extract the basic properties
  const props = itemObj.properties || {};
  
  // Map common properties to our standardized object format
  const tcObject = {
    id: itemObj.uid || (props.item_id as string) || '',
    name: (props.object_name as string) || '',
    type: itemObj.type || 'Unknown',
    revision: (props.item_revision_id as string) || 'A', // Ensure revision always has a default value ('A')
    owner: (props.owning_user as string) || 'Unknown',
    modifiedDate: (props.last_mod_date as string) || new Date().toISOString(),
    status: getItemStatus(props),
    description: (props.object_desc as string) || '',
    title: (props.object_string as string) || '',
  };
  
  logger.debug(`[${convertRequestId}] Converted item ${tcObject.id} (${tcObject.name})`);
  return tcObject;
};

// Helper function to determine item status
const getItemStatus = (props: Record<string, any>): TCObject['status'] => {
  const statusList = props.release_status_list as string | string[] | undefined;
  
  if (!statusList) return 'In Work';
  
  if (Array.isArray(statusList)) {
    if (statusList.includes('Released')) return 'Released';
    if (statusList.includes('In Review')) return 'In Review';
    if (statusList.includes('Obsolete')) return 'Obsolete';
  } else if (typeof statusList === 'string') {
    if (statusList === 'Released') return 'Released';
    if (statusList === 'In Review') return 'In Review';
    if (statusList === 'Obsolete') return 'Obsolete';
  }
  
  return 'In Work';
};
