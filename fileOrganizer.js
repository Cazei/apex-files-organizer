const path = require("path");
const fs = require("fs");

const COMMONS_DOMAIN = 'commons';

const classTypes = [
    "Service",
    "TriggerHandler",
    "Batch",
    "FailureCallback",
    "Callback",
    "Constants",
    "Impl",
    "Implementation",
    "Controller"
];
const classTypeMapping = new Map([
    ["Service", "Services"],
    ["TriggerHandler", "TriggerHandlers"],
    ["Batch", "Batches"],
    ["FailureCallback", "failureCallbacks"],
    ["Constants", "Constants"],
    ["Impl", "Implementations"],
    ["Implementation", "Implementations"],
    ["Controller", "Controllers"],
]);

const testClasses = [];

const pathParam = process.argv.indexOf('--path');
let classPathInput;

if(pathParam > -1 ){
    classPathInput = process.argv[pathParam +1];
}

function reorganizeFiles(classPath = "force-app/main/default/classes") {
    console.log(classPath);
    if (!fs.existsSync(classPath)) {
        throw new Error(`Path ${classPath} does not exist!`);
    }

    let files = fs.readdirSync(classPath).map((file) => `${classPath}/${file}`);

    let allFileDetails = files
        .filter((file) => fs.statSync(file).isFile())
        .map((file) => parse(file));

    prepareFinalFileLocations(allFileDetails.values(), classPath);
    moveFiles(allFileDetails.values());

}

function moveFiles(files){
    for(file of files){
        fs.renameSync(file.originalLocation, `${file.newLocation}/${file.fileName}`);
    }
}

function prepareFinalFileLocations(fileDetails, classPath) {
    for (fileDetail of fileDetails) {
        let classTypeFolder = classTypeMapping.get(fileDetail.classType);

        if (!fileDetail.classType) {
            if (fileDetail.isTest) {
                fileDetail.newLocation = `${classPath}/${fileDetail.domain}/tests`;
            } else {
                fileDetail.newLocation = `${classPath}/${fileDetail.domain}/src`;
            }
        } else {
            if (fileDetail.isTest) {
                fileDetail.newLocation = `${classPath}/${fileDetail.domain}/${classTypeFolder}/tests`;
            } else {
                fileDetail.newLocation = `${classPath}/${fileDetail.domain}/${classTypeFolder}/src`;
            }
        }
        fileDetail.newLocation = fileDetail.newLocation.replace('//','/');
        console.log(fileDetail);
        createIfDoesntExist(fileDetail.newLocation);
    }
}

function createIfDoesntExist(folder) {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
}

function parse(file) {
    const parsedFile = path.parse(file);

    const fileName = parsedFile.base;
    const pureFileName = removeExtensions(fileName);

    let fileDetails = {
        fileName: fileName,
        domain: "",
        classType: "",
        isTest: isTestClass(parsedFile),
        originalLocation: file,
    };

    const regex = new RegExp(`(?:${classTypes.join("|")})`, "g");
    const matchArray = [...pureFileName.matchAll(regex)];

    if (matchArray.length > 0) {
        fileDetails.classType = matchArray[matchArray.length - 1][0];
    }

    if (pureFileName.includes("_")) {
        let parts = pureFileName.split("_");
        let lastPart = parts[parts.length - 1];


        let domain = parts[0];
        console.log('Parts: ', parts);

        if (
            hasUnderscoreTestInName(pureFileName) &&
            parts.length == 2
        ) {
            fileDetails.domain = COMMONS_DOMAIN;
        } else {
            fileDetails.domain = domain;
        }
    }else {
        fileDetails.domain = COMMONS_DOMAIN;
    }
    return fileDetails;
}

function removeExtensions(fileName) {
    return fileName.split(".")[0];
}

function isTestClass(file) {
    const pathToFile = file.dir + "/" + file.base;
    const fileContents = fs.readFileSync(pathToFile);

    const regex = /@istest/i;
    if (regex.test(fileContents)) {
        testClasses.push(removeExtensions(file.base));
        return true;
    } else {
        if (testClasses.includes(removeExtensions(file.base))) {
            return true;
        }
    }
    return false;
}

reorganizeFiles(classPathInput);
