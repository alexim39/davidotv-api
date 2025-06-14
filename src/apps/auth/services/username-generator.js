import { UserModel } from "../../user/models/user.model.js";


/** 
 * Generate a unique username for user when sign in up into the system
 * This username is used by SignUpFormHandler
 */
export const generateUniqueUsername = async (name, lastname) => {
    if (!name || !lastname) {
      throw new Error("Name and lastname are required to generate a username");
    }
  
    const baseUsername = (name.charAt(0) + lastname).toLowerCase();
    let candidateUsername = baseUsername;
    let counter = 1;
  
    while (true) {
      const existingUser = await UserModel.findOne({ username: candidateUsername }).exec();
      if (!existingUser) return candidateUsername;
      candidateUsername = `${baseUsername}${counter++}`;
    }
  };
  