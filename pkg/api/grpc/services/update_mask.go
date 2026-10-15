package services

import (
	"fmt"
	"strings"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// maxUpdateMaskDepth bounds the descriptor walk for nested resource fields.
const maxUpdateMaskDepth = 6

// resourceMask classifies update mask paths for one resource type. When an
// HTTP client omits the update mask, grpc-gateway derives it from every key
// of the JSON request body (see runtime.FieldMaskFromRequestBody), so a
// full-resource PATCH yields paths for output-only fields such as name or
// create_time as well. Per AIP-134 such requests mean "update the mutable
// fields as provided": known non-mutable paths are tolerated and ignored,
// while paths that name no field of the resource at all are rejected.
type resourceMask struct {
	// mutable are the paths that drive updates.
	mutable map[string]struct{}
	// known is every field path of the resource, mutable or not.
	known map[string]struct{}
}

func newResourceMask(msg proto.Message, mutable []string) *resourceMask {
	rm := &resourceMask{
		mutable: make(map[string]struct{}, len(mutable)),
		known:   map[string]struct{}{},
	}
	for _, p := range mutable {
		rm.mutable[p] = struct{}{}
	}
	collectFieldPaths(msg.ProtoReflect().Descriptor(), "", 0, rm.known)
	return rm
}

// resolve returns the subset of paths that name mutable fields, in a
// canonical form suitable for the update logic. An empty path list means
// "update all mutable fields" (AIP-134) and resolves to nil.
func (rm *resourceMask) resolve(paths []string) ([]string, error) {
	if len(paths) == 0 {
		return nil, nil
	}

	out := make([]string, 0, len(paths))
	for _, p := range paths {
		if _, ok := rm.mutable[p]; ok {
			out = append(out, p)
			continue
		}
		if _, ok := rm.known[p]; ok {
			// Output-only or otherwise non-mutable field: ignored.
			continue
		}
		return nil, fmt.Errorf("unknown field %q in update mask", p)
	}
	return out, nil
}

// collectFieldPaths adds every field path of md (and of nested messages of
// this API, up to maxUpdateMaskDepth) to paths. Well-known types are leaves:
// their JSON representations are scalars, so masks never name their inner
// fields.
func collectFieldPaths(md protoreflect.MessageDescriptor, prefix string, depth int, paths map[string]struct{}) {
	if depth > maxUpdateMaskDepth {
		return
	}

	fields := md.Fields()
	for i := 0; i < fields.Len(); i++ {
		fd := fields.Get(i)

		path := string(fd.Name())
		if prefix != "" {
			path = prefix + "." + path
		}
		paths[path] = struct{}{}

		if fd.Kind() != protoreflect.MessageKind || fd.IsList() || fd.IsMap() {
			continue
		}
		if sub := fd.Message(); sub != nil && !strings.HasPrefix(string(sub.FullName()), "google.protobuf.") {
			collectFieldPaths(sub, path, depth+1, paths)
		}
	}
}
