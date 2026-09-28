function run() {
    var fileString = $.NSString.stringWithContentsOfFileEncodingError('js/admin.js', $.NSUTF8StringEncoding, null);
    if (!fileString) return "Could not read file";
    try {
        eval(ObjC.unwrap(fileString));
        return "Syntax OK";
    } catch(e) {
        return "Syntax Error: " + e.message;
    }
}
