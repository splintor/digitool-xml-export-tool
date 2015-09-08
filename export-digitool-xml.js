'use strict';
var shell = safeRequire("shelljs");
var fs = safeRequire('fs');
var xml2js = safeRequire('xml2js');
var argv = safeRequire('optimist')
    .usage('Usage: $0 [-s <source>] [-o <output CSV file>]')
    .alias('s', 'source')
    .describe('s', 'Source - Can be a DigiTool XML file, or a zip file or a directory containing DigiTool XML files')
    .demand('s')
    .alias('o', 'output')
    .describe('o', 'Output language JSON file. <stdout> is used if omitted')
    .default('o', 'data.csv')
    .argv;

var sourceFile = argv.source;
var outputFile = argv.output;

var fields = ['source file',
    'dc:title',
    'dc:creator',
    'dc:date',
    'dcterms:isPartOf',
    'dc:source',
    'dcterms:abstract',
    'dc:description',
    'dcterms:externalcollectionid',
    'dcterms:dcterms',
    'dcterms:content',
    'dcterms:medium'];

var stat = fs.statSync(argv.source);
if(stat.isDirectory()) {
    try {
        var errors = 0;
        var success = 0;
        var files = fs.readdirSync(argv.source);
        createOutputFile();
        files.forEach(function(file) {
            try {
                if(!file.match(/\.xml$/i)) { return; }
                //console.log('Parsing file: ' + file);
                var fileData = getDataFromXmlFile(argv.source + '/' + file);
                fs.appendFileSync(argv.output, fileData + '\r\n');
                ++success;
            } catch(e) {
                ++errors;
                error(e);
            }
        });
        if(errors) {
            console.log("Data from " + success + " xml files in '" + argv.source + "' was exported to " + argv.output);
            error('A problem was encountered in ' + errors + ' files')
        } else {
            success("Data from " + success + " xml files in '" + argv.source + "' was successfully exported to " + argv.output);
        }
    } catch(e) {
        error(e, 3);
    }
} else if(argv.source.match(/\.zip$/i)) {
    try {
        var zipErrors = 0;
        var zipSuccess = 0;
        var zip = safeRequire('node-zip')(getFileContent(argv.source, 'binary'));
        createOutputFile();
        for(var file in zip.files) {
            try {
                if(!file.match(/\.xml$/i)) { return; }
                var fileData = getDataFromFileText(zip.files[file].asText(), file);
                fs.appendFileSync(argv.output, fileData + '\r\n');
                ++zipSuccess;
            } catch(e) {
                ++zipErrors;
                error(e);
            }
        }
        if(zipErrors) {
            console.log("Data from " + zipSuccess + " xml files in '" + argv.source + "' was exported to " + argv.output);
            error('A problem was encountered in ' + zipErrors + ' files')
        } else {
            success("Data from " + zipSuccess + " xml files in '" + argv.source + "' was successfully exported to " + argv.output);
        }
    } catch(e) {
        error(e, 2);
    }
} else {
    try {
        var fileData = getDataFromXmlFile(argv.source);
        createOutputFileIfNotExist();
        fs.appendFileSync(argv.output, fileData + '\r\n');
        success("Data from file '" + argv.source + "' was successfully exported to " + argv.output);
    } catch(e) {
        error(e, 1);
    }
}

function createOutputFileIfNotExist() {
    if(!fs.existsSync(argv.output)) {
        createOutputFile();
    }
}
function createOutputFile() {
    fs.appendFileSync(argv.output, fields.map(function (f) {
            return f.split(':')[1] || f;
        }).join() + '\r\n');
}

function getFileContent(sourceFile, options) {
    if (!fs.existsSync(sourceFile)) {
        throw "The source file '" + sourceFile + "' does not exist.";
    }

    return fs.readFileSync(sourceFile, options);
}
function getDataFromXmlFile(sourceFile) {
    return getDataFromFileText(getFileContent(sourceFile), sourceFile);
}

function getDataFromFileText(fileText, sourceFile) {
    var innerXml;
    var error;
    new xml2js.Parser().parseString(fileText, function xmlParseCallback(err, result) {
        if (err) {
            error = "Failed to parse '" + sourceFile + "' text.\nerr: " + err + "\file text: " + fileText;
            return;
        }

        var digital_entity_call = result['xb:digital_entity_call'];
        if (!digital_entity_call) {
            error = "Failed to find <xb:digital_entity_call> element in " + sourceFile;
            return;
        }

        var mdItems = digital_entity_call['xb:digital_entity'][0].mds[0].md;
        if (!mdItems) {
            error = "Failed to find mdItems in " + sourceFile;
            return;
        }

        mdItems.forEach(function (md) {
            if (md.value[0].indexOf('xmlns:dc') > 0) {
                innerXml = md.value[0];
                return;
            }
        })
    });

    if(error) {
        throw error;
    }

    if (!innerXml) {
        throw "Failed to find innerXml in " + sourceFile;
    }

    new xml2js.Parser().parseString(innerXml, function xmlParseCallback(err, result) {
        if (err) {
            error = "Failed to parse innerXml.\nerr: " + err + "\ninnerXml: " + innerXml;
            return;
        }

        var record = result.record;

        var d = fields.map(function (field) {
            var data = field.indexOf(':') > 0 ? record[field] : sourceFile;
            data = data ? (data.map ? data.map(function(s) { return s._ || s; }).join('; ') : (data._ || data)) : '';
            data = data.replace(/\"/g, '""')
            return '"' + data + '"';
        })

        return d.join();
    });

    if(error) {
        throw error;
    }
}

function getFieldData(fieldName, record, sourceFile) {
}

function safeRequire(libName) {
    try {
        return require(libName);
    } catch(e) {
        if(shell) {
            try {
                console.log("Installing " + libName + "...");
                var child = shell.exec("npm install " + libName);
                if(child.code) {
                    error("Failed to install " + libName + ". Aborting...", 10);
                }

                return require(libName);
            }
            catch(e) {
                error("Failed to install " + libName + ". Aborting...", 11);
            }
        }
        else {
            error("Failed to find shelljs. In order to run this script, please run:\n    npm install shelljs", 12);
        }
    }
}

function error(s, exitCode) {
    console.error('\x1B[31m\x1B[1m' + s + '\x1B[39m\x1B[22m'); // make error red and bold
    if(exitCode) {
        process.exit(exitCode);
    }
}

function success(s) {
    console.log('\x1B[32m\x1B[1m' + s + '\x1B[39m\x1B[22m'); // make success green and bold
}