import path from 'path'
import Jimp from "jimp";
import { IssueCredentialPreviewV1, SchemaBuilder, toLocalISOString } from "./lib";

enum  PersonAtributes {
    GivenName="given_names",
    FamilyName="family_name",
    Picture="picture",
}

export class PersonSchema1 extends SchemaBuilder {
    constructor() {
        super()
        this.setName('Person').setVersion('1.0').setAttributes(Object.values(PersonAtributes))
    }
}

export class PersonCredential1 extends IssueCredentialPreviewV1 {
    constructor() {
        super()
        this.addAttribute({name: PersonAtributes.GivenName, value: "John"})
        this.addAttribute({name: PersonAtributes.FamilyName, value: `Doe (${toLocalISOString(new Date())})`})
        //this.addAttribute({name: ".meta", value: JSON.stringify({some:"thing"})})
    }
    async build () {
        if (!this.getAttributes().find((element) => element.name === PersonAtributes.Picture)){
            const image =  await Jimp.read(path.join(__dirname, 'assets/photo.jpeg')).then((image)=> {return image.scale(1.5)}).then(image=>{return image.getBase64Async(image.getMIME())})
            this.addAttribute({name: PersonAtributes.Picture, value: image})
        }
        return super.build()
    }
}

enum  LawyerAtributes {
    MemberStatus="Member Status",
    GivenName="Given Name",
    PPID="PPID",
    MemberStatusCode="Member Status Code",
    Surname="Surname"
}

export class LawyerCredential1 extends IssueCredentialPreviewV1 {
    constructor() {
        super()
        this.addAttribute({name: LawyerAtributes.PPID, value: '123456'})
        this.addAttribute({name: LawyerAtributes.MemberStatus, value: "Practising"})
        this.addAttribute({name: LawyerAtributes.MemberStatusCode, value: "PRAC"})
        this.addAttribute({name: LawyerAtributes.GivenName, value: "John"})
        this.addAttribute({name: LawyerAtributes.Surname, value: `Doe (${toLocalISOString(new Date())})`})
        //this.addAttribute({name: ".meta", value: JSON.stringify({some:"thing"})})
    }
    async build () {
        if (!this.getAttributes().find((element) => element.name === "picture")){
            const image =  await Jimp.read(path.join(__dirname, 'assets/photo.jpeg')).then((image)=> {return image.scale(1.5)}).then(image=>{return image.getBase64Async(image.getMIME())})
            this.addAttribute({name: "picture", value: image})
        }
        return super.build()
    }
}

export class LawyerCredentialSchema extends SchemaBuilder {
    constructor() {
        super()
        this.setName('Member Card').setVersion('1.0.0').setAttributes(Object.values(LawyerAtributes))
    }
}
