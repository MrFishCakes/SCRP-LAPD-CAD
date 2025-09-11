const ENDPOINTS = {
    // Identifiers
    GET_IDENTIFIERS: {
        path: '/get_identifiers',
        type: 'GET_IDENTIFIERS'
    },
    MODIFY_IDENTIFIER: {
        path: '/modify_identifiers',
        type: 'MODIFY_IDENTIFIER'
    },
    SET_IDENTIFIER: {
        path: '/set_identifier',
        type: 'SET_IDENTIFIER'
    },
    UNIT_PANIC: {
        path: '/unit_panic',
        type: 'UNIT_PANIC'
    },
    KICK_UNIT: {
        path: '/kick_unit',
        type: 'KICK_UNIT'
    },
    UNIT_STATUS: {
        path: '/unit_status',
        type: 'UNIT_STATUS'
    },
    GET_ACTIVE_UNITS: {
        path: '/get_active_units',
        type: 'GET_ACTIVE_UNITS'
    },
    UPDATE_UNIT_LOCATION: {
        path: '/unit_location',
        type: 'UNIT_LOCATION'
    },
    
    // Dispatch and Emergency Calls
    GET_CALLS: {
        path: '/get_calls',
        type: 'GET_CALLS'
    },
    NEW_DISPATCH: {
        path: '/new_dispatch',
        type: 'NEW_DISPATCH'
    },
    ATTACH_UNIT: {
        path: '/attach_unit',
        type: 'ATTACH_UNIT'
    },
    DETACH_UNIT: {
        path: '/detach_unit',
        type: 'DETACH_UNIT'
    },
    UPDATE_CALL_POSTAL: {
        path: '/set_call_postal',
        type: 'SET_CALL_POSTAL'
    },
    ADD_CALL_NOTE: {
        path: '/add_call_note',
        type: 'ADD_CALL_NOTE'
    },
    UPDATE_CALL_PRIMARY: {
        path: '/set_call_primary',
        type: 'SET_CALL_PRIMARY'
    },
    CLOSE_DISPATCH: {
        path: '/close_call',
        type: 'CLOSE_CALL'
    },
    NEW_911_CALL: {
        path: '/call_911',
        type: 'NEW_911_CALL'
    },
    REMOVE_911: {
        path: '/remove_911',
        type: 'REMOVE_911'
    },
};

module.exports = { ENDPOINTS };