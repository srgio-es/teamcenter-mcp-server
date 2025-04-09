// Mock service implementation
export const mockCallService = async (service, operation, params) => {
    console.log(`SOA call (MOCK MODE): ${service}.${operation}`, params);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    // Mock responses based on service and operation
    if (service === 'Core-2011-06-Session' && operation === 'login') {
        const credentials = params.credentials;
        // Always accept admin/admin, but credentials with matching username/password also work in mock mode
        if ((credentials.user === 'admin' && credentials.password === 'admin') ||
            (credentials.user === credentials.password)) {
            return {
                serverInfo: {
                    version: "14.0.0.0",
                    instanceName: "Mock TC Server",
                    hostName: "localhost"
                },
                sessionId: 'mock-session-123',
                userId: credentials.user,
                userName: credentials.user === 'admin' ? 'Administrator' : credentials.user,
                groupId: 'group-1',
                groupName: 'Engineering',
                roleId: 'role-1',
                roleName: 'Engineer'
            };
        }
        throw new Error('Invalid credentials');
    }
    if (service === 'Core-2007-06-Session' && operation === 'logout') {
        return { success: true };
    }
    if (service === 'Query-2012-10-Finder' && operation === 'performSearch') {
        // Extract the search parameters
        const searchParams = params.searchInput || {};
        const savedQueryName = searchParams.searchCriteria?.savedQueryName;
        console.log(`Performing search with saved query: ${savedQueryName}`);
        // Mock search results for the new API format
        const mockItems = [
            {
                uid: 'item-001',
                type: 'Item',
                properties: [
                    { name: 'object_name', value: 'Part ABC-123' },
                    { name: 'object_desc', value: 'Mechanical part for assembly' },
                    { name: 'object_string', value: 'ABC-123: Mechanical part' },
                    { name: 'item_revision_id', value: 'A' },
                    { name: 'release_status_list', value: 'Released' },
                    { name: 'owning_user', value: 'Administrator' },
                    { name: 'last_mod_date', value: '2023-08-15' }
                ],
                revisions: [
                    {
                        uid: 'itemrev-001-A',
                        type: 'ItemRevision',
                        properties: [
                            { name: 'object_name', value: 'Part ABC-123' },
                            { name: 'object_desc', value: 'Mechanical part for assembly' },
                            { name: 'object_string', value: 'ABC-123: Mechanical part' },
                            { name: 'item_revision_id', value: 'A' },
                            { name: 'release_status_list', value: 'Released' },
                            { name: 'owning_user', value: 'Administrator' },
                            { name: 'last_mod_date', value: '2023-08-15' }
                        ]
                    }
                ]
            },
            {
                uid: 'item-002',
                type: 'Item',
                properties: [
                    { name: 'object_name', value: 'Assembly XYZ-789' },
                    { name: 'object_desc', value: 'Final assembly for product' },
                    { name: 'object_string', value: 'XYZ-789: Final assembly' },
                    { name: 'item_revision_id', value: 'B' },
                    { name: 'release_status_list', value: 'In Review' },
                    { name: 'owning_user', value: 'Administrator' },
                    { name: 'last_mod_date', value: '2023-09-20' }
                ],
                revisions: [
                    {
                        uid: 'itemrev-002-B',
                        type: 'ItemRevision',
                        properties: [
                            { name: 'object_name', value: 'Assembly XYZ-789' },
                            { name: 'object_desc', value: 'Final assembly for product' },
                            { name: 'object_string', value: 'XYZ-789: Final assembly' },
                            { name: 'item_revision_id', value: 'B' },
                            { name: 'release_status_list', value: 'In Review' },
                            { name: 'owning_user', value: 'Administrator' },
                            { name: 'last_mod_date', value: '2023-09-20' }
                        ]
                    }
                ]
            }
        ];
        return {
            searchResults: mockItems,
            totalFound: mockItems.length,
            totalLoaded: mockItems.length,
            searchFilterMap: {
                "Item Type": [{
                        searchFilterType: "StringFilter",
                        stringValue: "Item",
                        startDateValue: "",
                        endDateValue: "",
                        startNumericValue: 0,
                        endNumericValue: 0,
                        count: 2,
                        selected: true,
                        startEndRange: ""
                    }],
                "Owner": [{
                        searchFilterType: "StringFilter",
                        stringValue: "Administrator",
                        startDateValue: "",
                        endDateValue: "",
                        startNumericValue: 0,
                        endNumericValue: 0,
                        count: 2,
                        selected: true,
                        startEndRange: ""
                    }]
            },
            searchFilterCategories: [{
                    internalName: "Item Type",
                    displayName: "Item Type",
                    defaultFilterValueDisplayCount: 5
                }],
            defaultFilterFieldDisplayCount: 5,
            searchFilterFieldSortType: "Alphabetical",
            serviceData: {},
            // Keep objects for backward compatibility
            objects: mockItems
        };
    }
    throw new Error(`Unimplemented SOA service: ${service}.${operation}`);
};
//# sourceMappingURL=tcMockService.js.map