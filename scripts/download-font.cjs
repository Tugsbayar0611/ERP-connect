const fs = require('fs');
const https = require('https');
const path = require('path');

const fileUrl = "https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Regular.ttf";
const outputPath = path.resolve(__dirname, '../client/public/fonts/Roboto-Regular.ttf');

console.log(`Downloading font from ${fileUrl} to ${outputPath}...`);

const file = fs.createWriteStream(outputPath);
https.get(fileUrl, function (response) {
    if (response.statusCode === 302 || response.statusCode === 301) {
        console.log(`Redirecting to ${response.headers.location}...`);
        https.get(response.headers.location, function (response2) {
            response2.pipe(file);
            file.on('finish', function () {
                file.close(() => {
                    console.log("Download completed successfully!");
                });
            });
        });
    } else {
        response.pipe(file);
        file.on('finish', function () {
            file.close(() => {
                console.log("Download completed successfully!");
            });
        });
    }
}).on('error', function (err) { // Handle errors
    fs.unlink(outputPath, () => { }); // Delete the file async. (But we don't check the result)
    console.error("Error downloading file: " + err.message);
});
