module.exports = {
    create: function STC_STORAGE_OBJECT(type, name) {
        return {
            type: type || 'Object',
            name: name,
            _STC_STORAGE_TYPE: true
        };
    },
    is: function STC_IS_STORAGE_OBJ(object) {
        return (object._STC_STORAGE_TYPE === true);
    }
};