var crypto = require('crypto');

var BufferTransfer = function STCBT_INIT(name, encoding, size, mutable) {
    // Split buffers larger than 64kb in chunks
    this.SPLIT_SIZE = 64000;
    
    this.name = name;
    this.encoding = encoding;
    this.mutable = (mutable === false)?false:true;
};

BufferTransfer.prototype.AllocatorObject = function STCBT_ALLOCATOR(size) {
    return {
        type: 'buffer',
        subtype: 'allocate',
        name: this.name,
        chunked: true,
        encoding: this.encoding,
        split: this.SPLIT_SIZE,
        size: size,
        mutable: this.mutable
    };
};

BufferTransfer.prototype.setBuffer = function STCBT_SET_BUFFER(buffer, chunky, encoding) {
    this.buffer = buffer;
    /* Add unchunked support */
    this.chunky = (chunky === true)?true:(buffer.length > this.SPLIT_SIZE);
    this.digest = crypto.createHash('md5').update(buffer, encoding).digest('hex');
};

BufferTransfer.prototype.each = function STCBT_EACH(func) {
    for(var i = 0; i < Math.ceil(this.buffer.length / this.SPLIT_SIZE); i++) {
        func({
            type: 'buffer',
            subtype: 'write',
            name: this.name,
            chunk: i,
            data: this.buffer.slice(this.SPLIT_SIZE * i, Math.min(this.SPLIT_SIZE * (i + 1), this.buffer.length)).toString(this.encoding),
            done: (i >= Math.ceil(this.buffer.length / this.SPLIT_SIZE) - 1)
        });
    }
};

module.exports = BufferTransfer;