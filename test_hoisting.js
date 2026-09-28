function run() {
    var output = "";
    try {
        (() => {
            output += (typeof window !== "undefined") + " ";
            var dummyWindow = {};
            dummyWindow.loadCases = loadCases;
            async function loadCases() {}
            output += (typeof dummyWindow.loadCases);
        })();
        return output;
    } catch(e) {
        return "Error: " + e.message;
    }
}
