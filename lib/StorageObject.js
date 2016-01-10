module.exports = {
    create: function STC_STORAGE_OBJECT(type, name, partition) {
        /**
         * @todo Add partitioning
         */
        return {
            type: type || 'Object',
            name: name,
            _STC_STORAGE_TYPE: true,
            partition: partition || {}
        };
    },
    is: function STC_IS_STORAGE_OBJ(object) {
        return (object._STC_STORAGE_TYPE === true);
    },
    toValue: function STC_STORAGE_OBJ_TO_VALUE(map, object) {
        if((object.partition.start !== undefined) && (object.partition.end !== undefined)) {
            return map.get(object.name).get(object.partition.start, object.partition.end - object.partition.start);
        }else{
            return map.get(object.name).get();
        }
    }
};