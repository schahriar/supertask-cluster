var crypto = require('crypto');

var BufferAllocator = function STCBA_INIT(name, size, encoding, immutable, split) {
    this.name = name;
    this.encoding = encoding;
    this.immutable = immutable || false;
    this.SPLIT_SIZE = split;
    this.done = false;
    this.size = size;
    // Allocate Buffer
    this.buffer = new Buffer(size);
};

BufferAllocator.prototype.set = function STCBA_SET(data, chunk) {
    if(this.immutable && this.done) return;
    this.buffer.write(data, chunk*this.SPLIT_SIZE, undefined, this.encoding);
};

BufferAllocator.prototype.get = function STCBA_GET(offset, length) {
    if(!this.done) return false;
    if(!this.immutable) {
        return this.buffer.slice(offset, offset+length);
    }else{
        var CopyBuffer = new Buffer(length);
        this.buffer.copy(CopyBuffer, 0, offset, offset+length);
        return CopyBuffer;
    }
};

BufferAllocator.prototype.setDone = function STCBA_DONE() {
    this.done = true;
};

BufferAllocator.prototype.digest = function STCBA_DIGEST() {
    return crypto.createHash('md5').update(this.buffer, this.encoding).digest('hex');
};

module.exports = BufferAllocator;