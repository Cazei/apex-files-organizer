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

const args = process.argv;
const pathParam = args.indexOf('--path');
let classPathInput;

const namespaceParam = args.indexOf('--specificNamespace');
let specificNamespaceName;
const targetNamespaceParam = args.indexOf('--targetNamespace')
let targetNamespace;

function validations(){

    if(pathParam > -1 )
    {   
        classPathInput = args[pathParam +1];
        if(!classPathInput){
            throw new Error(`--path requires a path to classes!`);
        }
    }
    
    if(namespaceParam > -1){
        specificNamespaceName = args[namespaceParam +1];
        if(!specificNamespaceName){
            throw new Error(`--specificNamespace requires a namespace to be given!`);
        }
    

        if(targetNamespaceParam == -1){
            throw new Error('--targetNamespace has to be supplied when --specifiNamespace is used.');
        }
    }
    
    if(targetNamespaceParam > -1){
        targetNamespace = args[targetNamespaceParam +1];
        if(!targetNamespace){
            throw new Error('--targetNamespace has no value!')
        }
    }
}

function reorganizeFiles(classPath = "force-app/main/default/classes") {

    validations();

    if (!fs.existsSync(classPath)) {
        throw new Error(`Cannot find Path ${classPath}! Make sure youre running the script form a SFDX project!`);
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
        if(file.shouldMove){
            fs.renameSync(file.originalLocation, `${file.newLocation}/${file.fileName}`);
        }
    }
}

function prepareFinalFileLocations(fileDetails, classPath) {
    for (fileDetail of fileDetails) {
        let classTypeFolder = classTypeMapping.get(fileDetail.classType);

        if(!fileDetail.shouldMove){
            continue;
        }

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
        shouldMove: true
    };

    const regex = new RegExp(`(?:${classTypes.join("|")})`, "g");
    const matchArray = [...pureFileName.matchAll(regex)];

    if (matchArray.length > 0) {
        fileDetails.classType = matchArray[matchArray.length - 1][0];
    }

    if(shouldOnlyMoveSpecificNamespaces()){
        if(pureFileName.substring(0,specificNamespaceName.length) === specificNamespaceName){
            fileDetails.domain = targetNamespace;
        }else{
            fileDetails.shouldMove = false;
        }
    }else{
        if (pureFileName.includes("_")) {
            let parts = pureFileName.split("_");    
            let domain = parts[0];

            if (
                filenameWithUnderscoreTest(pureFileName) &&
                parts.length == 2
            ) {
                fileDetails.domain = COMMONS_DOMAIN;
            } else {
                fileDetails.domain = domain;
            }
        }else {
            fileDetails.domain = COMMONS_DOMAIN;
        }
    }
    return fileDetails;
}


function shouldOnlyMoveSpecificNamespaces(){
    return specificNamespaceName !== undefined;
}

function filenameWithUnderscoreTest(filename){
    return filename.toLowerCase().includes('_test') || filename.toLowerCase().includes('_tests'); 
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
