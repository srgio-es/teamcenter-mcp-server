// Parse the JSON response based on the service and operation
export const parseJSONResponse = (service, operation, response) => {
    // Handle different API responses based on the service and operation
    if (service === 'Core-2006-03-Session' && operation === 'login') {
        // Handle legacy login response
        const userId = response['userId'] || '';
        const userName = response['userName'] || '';
        const group = response['group'] || '';
        const role = response['role'] || '';
        const sessionId = response['sessionId'] || '';
        const locale = response['locale'] || '';
        const sessionObject = {
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
        return sessionObject;
    }
    // Parse based on the operation
    if (service === 'Core-2011-06-Session' && operation === 'login') {
        // Handle the new login response format
        // First, ensure the response is in the expected format
        const loginResponseObj = response;
        // Extract user information from serverInfo
        const sessionObject = {
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
        return sessionObject;
    }
    if ((service === 'Core-2007-06-Session' || service === 'Core-2008-06-Session') && operation === 'logout') {
        // Handle logout response, typically just return success
        return { status: 'OK' };
    }
    if (service === 'Query-2012-10-Finder' && operation === 'performSearch') {
        // For search operations, parse the search results
        const searchResponseObj = response;
        // Extract the relevant information from the response
        const searchResults = searchResponseObj.searchResults || [];
        const searchResponse = {
            searchResults: searchResults.map((obj) => ({
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
            objects: searchResults.map((obj) => ({
                uid: obj.uid || '',
                type: obj.type || '',
                properties: obj.props || obj.properties || {}
            }))
        };
        return searchResponse;
    }
    // Default response handling for unimplemented operations
    console.warn(`Unimplemented JSON response parsing for service: ${service}.${operation}`);
    return response;
};
// Convert a Teamcenter API object to a standardized TCObject
export const convertToTCObject = (itemObj) => {
    // Extract the basic properties
    const props = itemObj.properties || {};
    // Map common properties to our standardized object format
    return {
        id: itemObj.uid || props.item_id || '',
        name: props.object_name || '',
        type: itemObj.type || 'Unknown',
        revision: props.item_revision_id || 'A', // Ensure revision always has a default value ('A')
        owner: props.owning_user || 'Unknown',
        modifiedDate: props.last_mod_date || new Date().toISOString(),
        status: getItemStatus(props),
        description: props.object_desc || '',
        title: props.object_string || '',
    };
};
// Helper function to determine item status
const getItemStatus = (props) => {
    const statusList = props.release_status_list;
    if (!statusList)
        return 'In Work';
    if (Array.isArray(statusList)) {
        if (statusList.includes('Released'))
            return 'Released';
        if (statusList.includes('In Review'))
            return 'In Review';
        if (statusList.includes('Obsolete'))
            return 'Obsolete';
    }
    else if (typeof statusList === 'string') {
        if (statusList === 'Released')
            return 'Released';
        if (statusList === 'In Review')
            return 'In Review';
        if (statusList === 'Obsolete')
            return 'Obsolete';
    }
    return 'In Work';
};
//# sourceMappingURL=tcResponseParser.js.map