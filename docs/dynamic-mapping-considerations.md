# Considerations for dynamic mapping

In order for dynamic mapping to work as expected, the following constraints must be fulfilled.

- Submission data paths are described in the API property name, with components seperated by ".". Arrays do not denoted differently than objects.
	- Ex: ``Person.Name`` corresponds to a submission data mapping of ``{ Person: { Name: "name here" } }``
- API property names must be unique, even if the expected output names are the same.
	- Ex: If you have two different ``"Id"`` properties in your submission, one of them should be named something like ``"Id2"`` to remain unique
- Expected output path is described in the "jsonpath" property on the component. Components of paths are separated by ">". Any arrays expected in the output are denoted by ending the component name with "\[".
- Base paths are contained within a singular object called "Base_Paths". Each key is the name of a base path, and components of paths are separated by ">". Any arrays expected in the output are denoted by ending the component name with "\[".
	- Example: ``{ "basePath": "A>B[>C" }`` corresponds to a mapping of ``{ A: { B: [ { C : "base path starts here" } ] } }``
- Base paths can only be used in output paths. They should be denoted in output paths by starting them with a $
	- Ex: in a component with API property name Person.Name, the properties could look like ``{ jsonpath: "$basePath>name" }``. Assuming the base path is the same as the example above, the output mapping would be
	``{ A: { B: [ { C : { "name": "name here" } } ] } }``
- Base paths cannot be used in other base paths.
