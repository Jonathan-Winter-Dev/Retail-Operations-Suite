// THIS TOOL IS USED AS A LOCAL FILE, SO MODULES CANNOT BE USED.
// I WILL TRY TO MAKE IT SOMEWHAT ORGANISED WITH A TABLE OF CONTENTS
// THAT ESTIMATES HOW I WOULD HAVE SPLIT THE CODE IN TO MODULES.
// ALL HELPER FUNCTIONS ARE IN THEIR RESPECTIVE AREAS.


// CONTENTS:
// 1. CONSTANTS AND GLOBAL VARIABLES
//  - CSV EXPORT SCHEMA

// 2. IIFE'S AND CLASS CONSTRUCTORS
//  - PRODUCT CLASS CONSTRUCTOR
//  - RMS CSV DATA STORAGE

// 3. UTILITIES
//  - SANITISATION
//  - PRICE COMPARISONS

// 4. CSV HANDLING & ENRICHMENT
//  - CSV IMPORTING
//  - CSV PARSING
//  - CSV EXPORTING
//  - ENRICHMENT FROM CSV

// 5. DOM AND UI CREATION
//  - TABLE FOR BARKER CREATION

// 6. TRANSFORMATION

// 7. ENTRY POINT
//  - EVENT LISTENERS

// 1. CONSTANTS AND GLOBAL VARIABLES


const csvSchema = (() => {

    const rmsRetailExportHeaders = [";Item Lookup Code", "Description", "Department", "Cost", "Reg. Price", "New Reg. Price"]

    const rmsCostExportHeaders = [";Item Lookup Code", "Description", "Department", "Cost", "Last Cost", "Replacement Cost", "New Cost", "New Last Cost", "New Replacement Cost"];

    const rmsSaleExportHeaders = [";Item Lookup Code", "Description", "Department", "Cost", "Reg. Price", "Sale Price", "Sale Start Date", "Sale End Date", "New Sale Price", "New Start Date", "New End Date"];

    const barkerExportHeaders = ["code", "wasPrice", "nowPrice", "multiBuy", "quantity"];

    const rmsDataImportFirstHeader = ";Supplier"

    return { rmsRetailExportHeaders, rmsCostExportHeaders, rmsSaleExportHeaders, barkerExportHeaders, rmsDataImportFirstHeader}
})()

// 2. IIFE'S AND CLASS CONSTRUCTORS
const allProducts =(() => {
    let arr = []

    let history = []

    let future = []

    const addProduct = (code) => {
        const sanitisedCode = sanitiseCode(code)

        let product = getProduct(sanitisedCode)

        if (!product) {
            product = new Product(sanitisedCode)
            arr.push(product)
        }

        return product
    }

    const getProduct = (code) => {
        const sanitisedCode = sanitiseCode(code)
        return arr.find((element) => element.code === sanitisedCode)
    }

    const deleteProduct = (code) => {
        const sanitisedCode = sanitiseCode(code)
        arr = arr.filter((element) => element.code !== sanitisedCode)
    }

    const getBulkEditableProducts = () => {
        return arr.filter((product) => (!product.locked && product.selected))
    }

    const clearProducts = () => arr = []

    const getProducts = () => [...arr]

    const undo = () => {
        if (!history.length) return

        future.push(structuredClone(arr))

        arr = history.pop()
    }

    const redo = () => {
        if (!future.length) return

        history.push(structuredClone(arr))

        arr = future.pop()
    }

    const saveState = () => {
        future = []

        history.push(structuredClone(arr))

        if (history.length > 50) {
            history.shift()
        }
    }

    return { clearProducts, getProducts, addProduct, getProduct, deleteProduct, getBulkEditableProducts, undo, saveState, redo}
})()

class Product {
    constructor(code) {
        this.code = code
        this.description = ""
        this.department = ""
        this.rmsLookupCode = ""
        this.newProposedPrice = null
        this.rmsCostPrice = null
        this.rmsRetailPrice = null
        this.rmsSalePrice = null
        this.newRetailPrice = null
        this.newSalePrice = null
        this.newCostPrice = null
        this.category = ""
        this.multiBuy = ""
        this.saleStartDate = null
        this.saleEndDate = null
        this.stockQuantity = null
        this.selected = false
        this.supplier = ""
        this.locked = false
    }
} 

const csvInputsStore = (() => {
    let rmsData = []

    const setRmsData = (data) => rmsData = data

    const getRmsData = () => [...rmsData]

    const clearRmsData = () => rmsData = []

    const getRmsDataByCode = (code) => rmsData.find((item) => item.code === code)

    const isLoaded = () => {
        if (rmsData.length > 0) return true
        return false
    }

    return { setRmsData, getRmsData, clearRmsData, isLoaded, getRmsDataByCode}
})()


// 3. UTILITIES
// SANITISATION
function sanitiseNewPriceInput(obj) {
    obj.code = sanitiseCode(obj.code)
    obj.wasPrice = sanitisePrice(obj.wasPrice)
    obj.nowPrice = sanitisePrice(obj.nowPrice)
    obj.multiBuy = sanitiseMultiBuy(obj.multiBuy) || ""
    obj.costPrice = sanitisePrice(obj.costPrice) || ""

    return obj
}

function sanitiseMultiBuy(string) {
    if (!string) return ""

    if (string.slice(0,2).toUpperCase() === "NO") {
        return ""
    };

    if (string.toUpperCase() === "BOGOF") {
        return "BUY 1 GET 1 FREE";
    }

    //return the original string
    return string;
}

function sanitiseRmsObject(obj) {
    const sanitisedObj = {}

    sanitisedObj.rmsLookupCode = obj["Item Lookup Code"]
    sanitisedObj.supplier = obj[";Supplier"]
    sanitisedObj.code = (sanitiseCode(obj["Reorder No."]))
    sanitisedObj.description = (obj["Description"] || "").toUpperCase().trim()
    sanitisedObj.department = (obj["Department"] || "").toUpperCase().trim()
    sanitisedObj.rmsCostPrice = sanitisePrice(obj["Cost"])
    sanitisedObj.rmsRetailPrice = sanitisePrice(obj["Price"])
    sanitisedObj.rmsSalePrice = sanitisePrice(obj["Sale Price"])
    sanitisedObj.saleStartDate = stringToDate(obj["Sale Starts"]) || new Date()
    sanitisedObj.saleEndDate = stringToDate(obj["Sale Ends"]) || new Date()
    sanitisedObj.stockQuantity = Number(obj["On-Hand"]) || 0

    return sanitisedObj
}

//converts strings to date ojects and returns undefined if the string is not a valid input
function stringToDate(inputDate) {
    if (!inputDate || inputDate.length !== 10) {
        return undefined
    }

    const dateWithoutSlash = inputDate.replace(/\//g, "")

    const day = dateWithoutSlash.slice(0,2)
    const monthString = dateWithoutSlash.slice(2,4)
    const month = Number(monthString) - 1
    const year = dateWithoutSlash.slice(4)

    return new Date(year, month, day)
}

function dateToRmsCsvString(date) {
    if (!date) return ""; 

    const year = String(date.getFullYear())
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day =  String(date.getDate()).padStart(2, "0")

    return `${day}/${month}/${year}`
}

function inputToDate(value) {
    return value ? new Date(value) : undefined;
}

function dateToInputValue(date) {
    if (!date) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function sanitiseCode(code) {
    if(!code) return ""
    return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function sanitisePrice(price) {
    if (price === undefined || price === null || price === "") return null

    if(typeof price !== "number") {
        price = Number(price.replace(/[^0-9.]/g, '').trim())
    }

    return priceRound(price)
}

function priceRound(price) {
    return Math.round(price * 100) / 100
}


// PRICE COMPARISONS

function getProductsForRetailUpdate(productArr) {
    return productArr.filter(requiresRetailUpdate)
}

function getProductsForSaleUpdate(productArr) {
    return productArr.filter(requiresSaleUpdate)
}


function getProductsForCostUpdate(productsArr) {
    return productsArr.filter(requiresCostUpdate)
}

function requiresCostUpdate(product) {
    if (product.newCostPrice === null) return false

    return product.rmsCostPrice !== product.newCostPrice
}

function requiresRetailUpdate(product) {
    //ensures both fields have entries
    if (product.newRetailPrice === null) return false

    return product.newRetailPrice !== product.rmsRetailPrice
}

function requiresSaleUpdate(product) {
    //ensures both fields have entries
    if (product.newSalePrice === null) return false

    return product.newSalePrice !== product.rmsSalePrice
}

function getBarkerNowPrice(product) {
    if(product.newSalePrice) return product.newSalePrice
    if(product.newRetailPrice) return product.newRetailPrice
    return ""
}

function getBarkerWasPrice(product) {
    if(product.newRetailPrice) return product.newRetailPrice
    if(product.rmsRetailPrice) return product.rmsRetailPrice
    return ""
}


// 4. CSV HANDLING
// - CSV IMPORTING

function readCsvFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => {
            resolve(reader.result)
        }

        reader.onerror = () => {
            reject("Failed to read file")
        }
        reader.readAsText(file)
    })
}

// - CSV PARSING

//the csv has some junk lines at the top of the file, they need removing
// ";Supplier" is the first header that is valid
function stripCsvJunk(csv) {
    const lines = csv.split(/\r?\n/)

    const startIndex = lines.findIndex(line =>
        line.includes(csvSchema.rmsDataImportFirstHeader)
    )

    if (startIndex === -1) {
        throw new Error("Header not found")
    }

    return lines.slice(startIndex).join("\n")
}

//Parse csv in to array of objects
function parseCsv(csv) {
    const lines = csv.trim().split("\n");
    const headers = lines.shift().split(",")

    return lines.map(line => {
        const values = line.split(",");
        const obj = {};

        headers.forEach((header, i) => {
            //trims whitespace if there is a value, if not it gives the value an empty string so there is data for the key
            let value = values[i] ? values[i].trim() : "";
            obj[header.trim()] = value;
        })
        return obj;
    });
};

//  - CSV EXPORT

function getUniqueBarkersToBeMade(productsArr, inStockOnly) {
    const seenCodes = new Set()
    
    const barkersToBeMadeArr = productsArr.filter((item) => {
        //if there is no stock of the item then do not create a barker for it
        if(inStockOnly && item.stockQuantity <= 0) return false

        const needsUpdate = requiresRetailUpdate(item) || requiresSaleUpdate(item)

        if (!needsUpdate) return false

        let code = ""

        code = item.code.toUpperCase()

        if (seenCodes.has(code)) return false

        seenCodes.add(code)
        return true
    })

    return barkersToBeMadeArr
}

function downloadCostCsv() {

    const productsForCostUpdate = getProductsForCostUpdate(allProducts.getProducts())

    if (!productsForCostUpdate.length) return

    //Start of data URL
    let csvContent = "data:text/csv;charset=utf-8,";

    //headers for .csv and append it to the file
    const headers = csvSchema.rmsCostExportHeaders
    csvContent += headers + "\r\n";

    //loops over evey item and creates new lines for the .csv download
    for (const item of productsForCostUpdate) {
        let row = [];
        row.push(item.rmsLookupCode, item.description, item.department, item.rmsCostPrice, 0, 0, item.newCostPrice, item.rmsCostPrice, 0);
        
        csvContent += row + "\r\n";
    }
    //creates .csv for download
    let encodedUri = encodeURI(csvContent);
    window.open(encodedUri);

}

function downloadRetailCsv() {
    
    const productsForRetailUpdate = getProductsForRetailUpdate(allProducts.getProducts())

    if (!productsForRetailUpdate.length) return

    //Start of data URL
    let csvContent = "data:text/csv;charset=utf-8,";

    //headers for .csv and append it to the file
    const headers = csvSchema.rmsRetailExportHeaders
    csvContent += headers + "\r\n";

    //loops over evey item and creates new lines for the .csv download
    for (const item of productsForRetailUpdate) {
        let row = [];
        row.push(item.rmsLookupCode, item.description, item.department, item.rmsCostPrice, item.rmsRetailPrice, item.newRetailPrice);
        
        csvContent += row + "\r\n";
    }
    //creates .csv for download
    let encodedUri = encodeURI(csvContent);
    window.open(encodedUri);
}

function downloadSaleCsv() {

    const productsForSaleUpdate = getProductsForSaleUpdate(allProducts.getProducts())
    if (!productsForSaleUpdate.length) return

    //Start of data URL
    let csvContent = "data:text/csv;charset=utf-8,";

    //headers for .csv and append it to the file - the headers aren't actually important to get correct as RMS never imports the first line 
    //when importing sale prices anyway
    const headers = csvSchema.rmsSaleExportHeaders
    csvContent += headers + "\r\n";

    //loops over evey item and creates new lines for the .csv download
    for (const item of productsForSaleUpdate) {
        let row = [];
        row.push(item.rmsLookupCode, item.description, item.department, item.rmsCostPrice, item.rmsRetailPrice, item.rmsSalePrice, dateToRmsCsvString(item.saleStartDate), dateToRmsCsvString(item.saleEndDate), item.newSalePrice, dateToRmsCsvString(item.saleStartDate), dateToRmsCsvString(item.saleEndDate));
        
        csvContent += row + "\r\n";
    }
    //creates .csv for download
    let encodedUri = encodeURI(csvContent);
    window.open(encodedUri);
}

function downloadBarkerCsv() {
    const inStockOnly = document.querySelector("#inStockOnly").checked
    
    const barkersToBeMadeArr = getUniqueBarkersToBeMade(allProducts.getProducts(), inStockOnly)

    //Start of Data URL
    let csvContent = "data:text/csv;charset=utf-8,";

    //headers for .csv and append it to the file
    const headers = csvSchema.barkerExportHeaders
    csvContent += headers + "\r\n";

    //loops over evey item and creates new lines for the .csv download
    for (const item of barkersToBeMadeArr) {
        let row = [];
        row.push(item.code, getBarkerWasPrice(item), getBarkerNowPrice(item) , item.multiBuy || "", item.stockQuantity || 1);

        csvContent += row + "\r\n";
    };

    //creates .csv for download
    let encodedUri = encodeURI(csvContent);
    window.open(encodedUri);
}


// PRODUCT ENRICHMENT
function enrichProductFromRms(product) {
    if (!csvInputsStore.getRmsData().length) {
        const errMsg = "You must import RMS data first"
        alert(errMsg)
        throw new Error(errMsg)
    } else {
        const found = csvInputsStore.getRmsData().find((element) => element.code === product.code)

        if (found === undefined) {
            console.log("product not found")
            return product
        }
        const productKeys = Object.keys(product)

        productKeys.forEach((key) => product[key] = product[key] || found[key] || null)
    }
    return product
}

// 5. DOM AND UI CREATION
function createInputDropDown(productsArr) {

    const productInput = document.querySelector("#productInput")
    const productSuggestions = document.querySelector("#productSuggestions")

    productInput.addEventListener("input", () => {
        const value = sanitiseCode(productInput.value)
        if (value === "") return
        productSuggestions.innerHTML = ""
        
        const filteredArr = productsArr.filter((item) => item.code.includes(value))

        filteredArr.forEach((item) => {
            const productLi = createElement("li", "", `${item.code} - ${item.description}`)
            productLi.addEventListener("click", () => {
                productInput.value = item.code
                productSuggestions.innerHTML = ""
            })
            productSuggestions.append(productLi)
        })
    })
}

function buildProductTable() {
    const productArr = allProducts.getProducts()
    const productTableBody = document.querySelector("#productTableBody")
    productTableBody.innerHTML = ""
    productArr.forEach((product) => {
        const tr = createElement("tr", "", "")
        tr.append(createProductDetailsTd(product))
        tr.append(createCurrentPricesTd(product))
        tr.append(createUpdateTd(product))
        tr.append(createActionsTd(product))

        //disables all inputs if the product entry is locked
        if (product.locked) {
            disableInputs(tr)
            tr.classList.add("lockedRow")
        }

        productTableBody.append(tr)
    })
}

function createUpdateTd(product) {
    const td = createElement("td", "update")
    const div =createElement("div", "update")

    div.append(createPriceInputDiv(product))
    div.append(createDateDiv(product))

    td.append(div)
    return td
}

function createDateDiv(product) {
    const div = createElement("div")

    const startDiv = createElement("div")
    startDiv.append(createElement("p", "", "Start Date:"))
    startDiv.append(createDateInput(product, "start"))

    const endDiv = createElement("div")
    endDiv.append(createElement("p", "", "End Date:"))
    endDiv.append(createDateInput(product, "end"))

    div.append(startDiv, endDiv)

    return div
}

function createPriceInputDiv(product) {
    const prices = [
        {
            string: "Retail Price:",
            type: "newRetailPrice"
        },
        {
            string: "Cost Price:",
            type: "newCostPrice"
        },
                {
            string: "Sale Price:",
            type: "newSalePrice"
        }
    ]

    const div = createElement("div")

    prices.forEach((price) => {
        const priceDiv = createElement("div")
        priceDiv.append(createElement("p", "", price.string))
        priceDiv.append(createNewPriceInput(product, price.type))
        div.append(priceDiv)
    })

    return div
}

function createCurrentPricesTd(product) {
    const td = createElement("td", "current")
    const div = createElement("div", "current")

    const ul = createElement("ul")
    ul.append(createElement("li", "", `Retail: £${product.rmsRetailPrice}`))
    ul.append(createElement("li", "", `Sale: £${product.rmsSalePrice ?? "N/A"}`))
    ul.append(createElement("li", "", `Cost: £${product.rmsCostPrice}`))

    div.append(ul)
    td.append(div)
    return td
}

function createProductDetailsTd(product) {
    const td = createElement("td", "details")
    const div = document.createElement("div", "details")

    div.append(createElement("p", "", `SKU: ${product.code}`))
    div.append(createElement("p", "", `Description: ${product.description}`))


    const details = createProductDetails(product)
    div.append(details)

    td.append(div)

    return td
}

function createActionsTd(product) {
    const td = createElement("td", "actions")
    const div = createElement("div", "actions")

    div.append(createLockCheckbox(product))
    div.append(createSelectedCheckbox(product))
    div.append(createProductClearButton(product))

    td.append(div)
    return td
}

function createProductDetails(product) {
    const details = createElement("details", "", "")
    details.append(createElement("summary", "", "More..."))

    const detailsToBeMade = [
        `RMS Lookup: ${product.rmsLookupCode}`,
        `Stock: ${product.stockQuantity}`,
        `Supplier: ${product.supplier}`,
        `Department: ${product.department}`,
        `Sale Start: ${dateToRmsCsvString(product.saleStartDate)}`,
        `Sale End: ${dateToRmsCsvString(product.saleEndDate)}`

    ]
    const ul = createElement("ul")

    detailsToBeMade.forEach((item) => {
        ul.append(createElement("li", "", item))
    })

    details.append(ul)
    return details
}

function disableInputs(tr)  {
    const trInputs = tr.querySelectorAll("input")

    trInputs.forEach((input) => {
        //Ensures the lock check box is not disabled, otherwise the product will never be able to be unlocked
        if (input.classList.contains("lockCheckBox")) return

        input.disabled = true
    })
}

function createLockCheckbox(product) {
    const lockCheckbox = createElement("input", "", "")

    lockCheckbox.type = "checkbox"
    lockCheckbox.checked = product.locked
    lockCheckbox.classList.add("lockCheckBox")

    lockCheckbox.addEventListener("change", () => {
        allProducts.saveState()
        setLocked(product.code, lockCheckbox.checked)
        buildProductTable()
    })

    return lockCheckbox
}

function createSelectedCheckbox(product) {
    const selectedCheckbox = createElement("input", "", "")
    
    selectedCheckbox.type = "checkbox"
    selectedCheckbox.classList.add("selectCheckBox")
    selectedCheckbox.checked = product.selected

    selectedCheckbox.addEventListener("change", () => {
        allProducts.saveState()
        product.selected = selectedCheckbox.checked
        buildProductTable()
    })

    return selectedCheckbox
}

function createProductClearButton(product) {
    const clearButton = createElement("button", "iconButton")
    
    const img = createElement("img")
    img.src = "./images/delete.svg"

    clearButton.append(img)

    clearButton.addEventListener(("click"), () => {
        allProducts.saveState()
        allProducts.deleteProduct(product.code)
        buildProductTable()
    })

    return clearButton
}

function createDateInput(product, startOrEnd) {
    const dateInput = createElement("input")
    dateInput.type = "date"

    if(startOrEnd === "start") {
        dateInput.value = dateToInputValue(product.saleStartDate)

        dateInput.addEventListener("change", () => {
            allProducts.saveState()
            product.saleStartDate = inputToDate(dateInput.value)
        })
    } else {
        dateInput.value = dateToInputValue(product.saleEndDate)

        dateInput.addEventListener("change", () => {
            allProducts.saveState()
            product.saleEndDate = inputToDate(dateInput.value)
        })
    }

    return dateInput
}

function createNewPriceInput(product, priceType) {
    const priceInput = createElement("input", "", "")
    priceInput.type = "text"
    priceInput.inputMode = "decimal"
    priceInput.value = product[priceType] || ""

    priceInput.addEventListener("change", (event) => {
        event.preventDefault()
        allProducts.saveState()
        product[priceType] = sanitisePrice(priceInput.value)
    })

    return priceInput
}

function createElement(elementType, className = "", innerText = "") {
    const element = document.createElement(elementType)
    if (className) {
        element.classList.add(className)
    }
    element.innerText = innerText 

    return element
}

// 6. TRANSFORMATION

function setLocked(code, lockedState) {
    const product = allProducts.getProduct(code)

    if (!product) return

    allProducts.saveState()

    product.locked = lockedState
}

function clearSelected() {
    const selectedArr = allProducts.getBulkEditableProducts()

    if (!selectedArr.length) return

    allProducts.saveState()

    selectedArr.forEach((item) => allProducts.deleteProduct(item.code))
}

function updateSelectedPrice(newPrice, priceType) {
    const arr = allProducts.getBulkEditableProducts()

    if (!arr.length) return

    const sanitisedPrice = sanitisePrice(newPrice)
    
    arr.forEach((item) => item[priceType] = sanitisedPrice)
}

function updateLocked(lockAllValue) {
    const arr = allProducts.getProducts()

    if (!arr.length) return

    allProducts.saveState()

    arr.forEach((item) => item.locked = lockAllValue)
}

function updateSelected(selectAllValue){
    const arr = allProducts.getProducts().filter((item) => (!item.locked))

    if (!arr.length) return

    allProducts.saveState()

    arr.forEach((item) => item.selected = selectAllValue)
}

function createNewPriceProduct(obj) {
    const newProposedPrice = obj.nowPrice
    const newProposedCostPrice = obj.costPrice

    const found = csvInputsStore.getRmsDataByCode(obj.code)

    if (!found) return 

    if (!requiresPriceChange(obj, found)) return

    const newProduct = allProducts.addProduct(obj.code)


    if (newProposedPrice !== null && newProposedPrice > found.rmsRetailPrice) {
        newProduct.newRetailPrice = obj.nowPrice
    } else if (newProposedPrice !== null && newProposedPrice !== found.rmsSalePrice && newProposedPrice < found.rmsRetailPrice){
        newProduct.newSalePrice = obj.nowPrice
    } 

    if (newProposedCostPrice !== null && newProposedCostPrice !== found.rmsCostPrice) {
        newProduct.newCostPrice = obj.costPrice
    }

    newProduct.multiBuy = obj.multiBuy

    enrichProductFromRms(newProduct)
}

function requiresPriceChange(newPricesObj, currentPricesObj) {
    if (newPricesObj.nowPrice && newPricesObj.nowPrice > currentPricesObj.rmsRetailPrice) return true
    if (newPricesObj.nowPrice && newPricesObj.nowPrice !== currentPricesObj.rmsSalePrice && newPricesObj.nowPrice < currentPricesObj.rmsRetailPrice) return true
    if (newPricesObj.costPrice && newPricesObj.costPrice && newPricesObj.costPrice !== currentPricesObj.rmsCostPrice) return true

    return false
}

function createProductFromInput(productCode, patternMatch) {
    if(!productCode.length) return

    allProducts.saveState()

    if (patternMatch) {
        const matchingRmsProducts = csvInputsStore.getRmsData().filter((item) => {
             return item.code.includes(productCode)
        })

        if (!matchingRmsProducts.length) {
            return false
        }

        matchingRmsProducts.forEach((item) => {
            const newProduct = allProducts.addProduct(item.code)
            enrichProductFromRms(newProduct)
        })
    } else {
        if (!csvInputsStore.getRmsDataByCode(productCode)) {
            return false
        }

        const newProduct = allProducts.addProduct(productCode)
        enrichProductFromRms(newProduct)
    }

    return true
}



// 7. ENTRY POINT
const clearSelectedButton = document.querySelector("#clearSelected")
clearSelectedButton.addEventListener("click", () => {
    clearSelected()
    buildProductTable()
})

const allProductsForm = document.querySelector("#allProductsForm")
allProductsForm.addEventListener("submit", (event) => {
    event.preventDefault()
    bulkPriceUpdate()
    buildProductTable()
})


function bulkPriceUpdate()  {
    const editableProducts = allProducts.getBulkEditableProducts()
    
    if (!editableProducts.length) return

    allProducts.saveState()

    const inputs = []

    const costPrice = document.querySelector("#allSelectedCostPrice")
    const salePrice = document.querySelector("#allSelectedSalePrice")
    const retailPrice = document.querySelector("#allSelectedRetailPrice")
    const saleEndDate = document.querySelector("#allProductsSaleEndDateUpdate")
    const saleStartDate = document.querySelector("#allProductsSaleStartDateUpdate")

    inputs.push(costPrice, salePrice, retailPrice, saleEndDate, saleStartDate)

    if (costPrice.value.length) updateSelectedPrice(costPrice.value, "newCostPrice")
    if (salePrice.value.length) updateSelectedPrice(salePrice.value, "newSalePrice")
    if (retailPrice.value.length) updateSelectedPrice(retailPrice.value, "newRetailPrice")
    if (saleEndDate.value.length) updateSelectedSaleDate(saleEndDate.value, "saleEndDate")
    if (saleStartDate.value.length) updateSelectedSaleDate(saleStartDate.value, "saleStartDate")

    inputs.forEach((input) => input.value = "")
}

function updateSelectedSaleDate(newDate, dateType) {
    console.log()
    const productArr = allProducts.getBulkEditableProducts()

    if (!productArr.length) return

    const date = inputToDate(newDate)

    productArr.forEach((item) => item[dateType] = date)
}

const selectAllProducts = document.querySelector("#selectAllProducts")
selectAllProducts.addEventListener("change", () => {
    updateSelected(selectAllProducts.checked)
    buildProductTable()
})


const lockAllProductInput = document.querySelector("#lockAllProducts")
lockAllProductInput.addEventListener("change", () => {
    updateLocked(lockAllProductInput.checked)
    buildProductTable()
})

const productInput = document.querySelector("#productInput")
const productInputAddButton = document.querySelector("#productInputAddButton")
productInputAddButton.addEventListener("click", () => {
    if (!csvInputsStore.isLoaded()) {
        alert("Must load RMS data before adding products")
        return
    }

    const sanitisedCode = sanitiseCode(productInput.value)
    const patternMatch = document.querySelector("#productPatternMatch").checked

    const found = createProductFromInput(sanitisedCode, patternMatch)

    if (!found) {
        alert("Product could not be found")
    }

    productInput.value = ""
    buildProductTable()
})

productInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        event.preventDefault()
        productInputAddButton.click()
    }
})

const newPriceCsvInput = document.querySelector(".newPriceCsvInput")
newPriceCsvInput.addEventListener("change", async (event) => {
    if (!csvInputsStore.isLoaded()) {
        alert("Please upload RMS master data")
        event.preventDefault()
        return
    }

    const file = event.target.files[0]
    const csvString = await readCsvFromFile(file)
    const arr = parseCsv(csvString)

    const sanitisedArr = arr.map((item) => sanitiseNewPriceInput(item))

    sanitisedArr.forEach((item) => {
        createNewPriceProduct(item)
    })

    buildProductTable()
})


//csv input for rms master - all cat codes and item lookup codes
const rmsMasterCsvInput = document.querySelector(".rmsMasterCsvInput");
rmsMasterCsvInput.addEventListener("change", async (event) => {
    // readRmsMasterCsv(event);
    const file = event.target.files[0]
    const csvString = await readCsvFromFile(file)
    const csvStringWithoutJunk = stripCsvJunk(csvString)
    const arr = parseCsv(csvStringWithoutJunk)
    
    const sanitisedArr = arr.map(item => sanitiseRmsObject(item))

    csvInputsStore.setRmsData(sanitisedArr)
    
    const productsArr = allProducts.getProducts()
    productsArr.forEach((product) => enrichProductFromRms(product))
    
    createInputDropDown(csvInputsStore.getRmsData())
});

//Button for downloading retail price updates as a .csv
const downloadRetail = document.querySelector(".downloadRetail");
downloadRetail.addEventListener("click", () => {
    downloadRetailCsv()
});

//Button for downloading sale price updates as a .csv
const downloadSale = document.querySelector(".downloadSale");
downloadSale.addEventListener("click", (event) => {
    downloadSaleCsv()
});

//button to download csv in a format that the barker maker can use
const downloadBarker = document.querySelector(".downloadBarker");
downloadBarker.addEventListener("click", (event) => {
    downloadBarkerCsv()
});

const downloadCost = document.querySelector(".downloadCost")
downloadCost.addEventListener("click", () => {
    downloadCostCsv()
})

const productSuggestions = document.querySelector("#productSuggestions")
document.addEventListener("click", (event) => {
    if (event.target !== productSuggestions) {
        productSuggestions.innerHTML = ""
    }
})

const undoButton = document.querySelector("#undoButton")
undoButton.addEventListener("click", () => {
    allProducts.undo()
    buildProductTable()
})

const redoButton = document.querySelector("#redoButton")
redoButton.addEventListener("click", () => {
    allProducts.redo()
    buildProductTable()
})