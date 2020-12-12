const { spawn, exec } = require('child_process');
const fs = require('fs');

const winsatDir = 'c:\\windows\\performance\\winsat\\datastore';

async function runAssessmentTool() {
    return new Promise(async (resolve, reject) => {
        const winsat = spawn(
            'powershell',
            ['-command', '"(start-process WinSAT formal -Verb RunAs -noexit -Wait)"']);

        winsat.stderr.on('data', (data) => reject(data.toString()));

        winsat.on('close', () => { 
            const watch = fs.watch(winsatDir);
            watch.once('change', (event, file) => {
                console.log(event)
                console.log(file)
                watch.close()
                resolve()
            });
        });
    });
}

async function getExperienceIndex() {
    return new Promise((resolve, reject) => {
        let output = "";
        const wei = spawn(
            'Get-WmiObject',
            ['-Class', 'Win32_WinSAT'],
            { shell: 'powershell.exe', windowsHide: true });

        wei.stderr.on('data', (data) => reject(data));

        wei.stdout.on('data', (data) => output += data.toString());

        wei.on('close', async (code) => {
            const experience = await mapWinsatToExperienceIndex(output);
            return resolve(experience);
        });
    });
}

async function mapWinsatToExperienceIndex(winsatOutput) {
    const fields = {
        'CPUScore': 'cpu',
        'D3DScore': 'gaming',
        'DiskScore': 'disk',
        'GraphicsScore': 'graphics',
        'MemoryScore': 'memory',
        'WinSPRLevel': 'base'
    };

    const outputLines = winsatOutput.split('\r\n');
    const properties = outputLines.filter(item => item.split(':')[0].trim() in fields);

    console.log(properties);

    const experience = {};

    properties.map(item => {
        const fieldKey = fields[item.split(':')[0].trim()];
        const value = item.split(':')[1].trim();

        experience[fieldKey] = parseFloat(value.replace(',', '.'));
    });

    console.log(experience);

    return experience;
}

async function getAssessmentDate() {
    return new Promise((resolve, reject) => {
        fs.readdir(winsatDir, function (err, files) {
            if (err) reject(err);

            files = files.map(fileName => {
                file = fs.statSync(winsatDir + '\\' + fileName);

                return {
                    name: fileName,
                    modifyTimestamp: file.mtime.getTime(),
                    modifyDatetime: file.mtime
                };
            }).sort((a, b) => b.modifyTimestamp - a.modifyTimestamp);

            resolve(files.length > 0 ? files[0].modifyDatetime : null);
        });
    });
}

async function getScoreLimits() {
    return new Promise((resolve, reject) => {
        let output = "";
        const wei = spawn(
            '(Get-WmiObject -Class Win32_OperatingSystem | ForEach-Object -MemberName Caption)',
            [],
            { shell: 'powershell.exe', windowsHide: true });

        wei.stderr.on('data', (data) => reject(data));

        wei.stdout.on('data', (data) => output += data.toString());

        wei.on('close', async (code) => {
            let osLimits = { from: 1, to: 0 };

            if (output.toLowerCase().includes('Vista')) {
                osLimits.to = 5.9;
            }
            else if (output.toLowerCase().includes('7')) {
                osLimits.to = 7.9;
            }
            else {
                osLimits.to = 9.9;
            }

            resolve(osLimits);
        });
    });
}

exports.runAssessmentTool = runAssessmentTool;
exports.getExperienceIndex = getExperienceIndex;
exports.getAssessmentDate = getAssessmentDate;
exports.getScoreLimits = getScoreLimits;