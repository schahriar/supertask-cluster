module.exports = {
    create: function STC_STORAGE_OBJECT(type, name) {
        /**
         * @todo Add partitioning
         */
        return {
            type: type || 'Object',
            name: name,
            _STC_STORAGE_TYPE: true
        };
    },
    is: function STC_IS_STORAGE_OBJ(object) {
        return (object._STC_STORAGE_TYPE === true);
    },
    toValue: function STC_STORAGE_OBJ_TO_VALUE(map, object) {
        return map.get(object.name).get();
    }
};