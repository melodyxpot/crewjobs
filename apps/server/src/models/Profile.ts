import mongoose, { Schema, Document } from "mongoose"

export interface IEducation {
  school: string
  degree: string
  field: string
  startDate: string
  endDate: string
  gpa?: string
  description?: string
}

export interface IExperience {
  company: string
  title: string
  location?: string
  startDate: string
  endDate: string
  current: boolean
  description?: string
}

export interface IProject {
  name: string
  url?: string
  description?: string
  technologies?: string
}

export interface IGeneratedResume {
  jobTitle: string
  company: string
  url: string
  createdAt: Date
}

export interface IEqualEmployment {
  authorizedToWork?: string
  disability?: string
  gender?: string
  requireSponsorship?: string
  lgbtq?: string
  veteran?: string
  race?: string
  hispanicOrLatino?: string
  sexualOrientation?: string
}

export interface IProfile extends Document {
  userId: mongoose.Types.ObjectId
  // Personal
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  linkedIn?: string
  github?: string
  portfolio?: string
  otherSocials?: string
  summary?: string
  // Resume file
  resumeFilename?: string
  resumeUrl?: string
  // Education
  education: IEducation[]
  // Experience
  experience: IExperience[]
  // Projects
  projects: IProject[]
  // Skills
  skills: string[]
  // Generated Resumes
  generatedResumes: IGeneratedResume[]
  // Equal Employment
  equalEmployment: IEqualEmployment
  createdAt: Date
  updatedAt: Date
}

const educationSchema = new Schema<IEducation>({
  school: { type: String, default: "" },
  degree: { type: String, default: "" },
  field: { type: String, default: "" },
  startDate: { type: String, default: "" },
  endDate: { type: String, default: "" },
  gpa: { type: String },
  description: { type: String },
}, { _id: true })

const experienceSchema = new Schema<IExperience>({
  company: { type: String, default: "" },
  title: { type: String, default: "" },
  location: { type: String },
  startDate: { type: String, default: "" },
  endDate: { type: String, default: "" },
  current: { type: Boolean, default: false },
  description: { type: String },
}, { _id: true })

const projectSchema = new Schema<IProject>({
  name: { type: String, default: "" },
  url: { type: String },
  description: { type: String },
  technologies: { type: String },
}, { _id: true })

const generatedResumeSchema = new Schema<IGeneratedResume>({
  jobTitle: { type: String, default: "" },
  company: { type: String, default: "" },
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true })

const equalEmploymentSchema = new Schema<IEqualEmployment>({
  authorizedToWork: { type: String, default: "" },
  disability: { type: String, default: "" },
  gender: { type: String, default: "" },
  requireSponsorship: { type: String, default: "" },
  lgbtq: { type: String, default: "" },
  veteran: { type: String, default: "" },
  race: { type: String, default: "" },
  hispanicOrLatino: { type: String, default: "" },
  sexualOrientation: { type: String, default: "" },
}, { _id: false })

const profileSchema = new Schema<IProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String },
    linkedIn: { type: String },
    github: { type: String },
    portfolio: { type: String },
    otherSocials: { type: String },
    summary: { type: String },
    resumeFilename: { type: String },
    resumeUrl: { type: String },
    education: { type: [educationSchema], default: [] },
    experience: { type: [experienceSchema], default: [] },
    projects: { type: [projectSchema], default: [] },
    skills: { type: [String], default: [] },
    generatedResumes: { type: [generatedResumeSchema], default: [] },
    equalEmployment: { type: equalEmploymentSchema, default: () => ({}) },
  },
  { timestamps: true }
)

export const Profile = mongoose.model<IProfile>("Profile", profileSchema)
